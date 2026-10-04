const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");
const {
  createOrganization,
  createSeatPool,
  createClassroom,
  createMember,
} = require("../../test/helpers/factories");
const SeatCredit = require("./seatCredit.model");
const SeatPool = require("./seatPool.model");
const SeatClaim = require("./seatClaim.model");
const OrgSeatReservation = require("./orgSeatReservation.model");
const StripeCheckoutRecord = require("./stripeCheckoutRecord.model");
const Organization = require("../organizations/organization.model");
const Enrollment = require("../enrollment/enrollment.model");
const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");
require("../tags/tags.model");
const { addSeats, applyClerkSeatGrant } = require("./seatCredit.service");
const { auditSeatCredits } = require("./seatCredit.audit");
const {
  processCheckoutSessionCompleted,
} = require("../stripe/stripe.webhook.service");
const { handleClerkWebhook } = require("../webhooks/clerk/clerk.controller");
const { applyOrganizationSeatGrants } = require("../../scripts/sync-clerk");

function creditFor(org, overrides = {}) {
  return {
    organizationId: org._id,
    source: "clerk",
    referenceId: "promotion",
    quantity: 5,
    actor: "test",
    ...overrides,
  };
}

function checkoutFor(org, overrides = {}) {
  return {
    id: "cs_test_seats",
    payment_status: "paid",
    metadata: {
      type: "org_seats",
      organizationId: String(org._id),
      quantity: "4",
    },
    ...overrides,
  };
}

function clerkData(id, grant) {
  return {
    id,
    name: "Professor",
    slug: id,
    created_at: Date.now(),
    updated_at: Date.now(),
    private_metadata: grant === undefined ? {} : { seatGrant: grant },
  };
}

async function deliverClerk(type, data) {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await handleClerkWebhook({ evt: { type, data } }, res);
  return res;
}

test("shared seat credits", async (t) => {
  t.after(teardownTestDb);
  await setupTestDb({ replicaSet: true });
  await Promise.all(
    [
      SeatCredit,
      SeatPool,
      StripeCheckoutRecord,
      Organization,
      SeatClaim,
      OrgSeatReservation,
      Enrollment,
    ].map((model) => model.init()),
  );
  t.beforeEach(clearCollections);

  await t.test(
    "a credit adds to existing balances once and preserves used seats",
    async () => {
      const org = await createOrganization();
      const pool = await createSeatPool(org._id, {
        totalSeats: 8,
        usedSeats: 3,
      });
      const first = await addSeats(creditFor(org));
      const repeated = await addSeats(creditFor(org));
      assert.equal(first.duplicate, false);
      assert.equal(repeated.duplicate, true);
      assert.equal(String(first.pool._id), String(pool._id));
      assert.equal(repeated.pool.totalSeats, 13);
      assert.equal(repeated.pool.usedSeats, 3);
      assert.equal(await SeatCredit.countDocuments(), 1);
      assert.equal(first.credit.createdBy, "test");
      assert.ok(first.credit.createdDate);
      await assert.rejects(addSeats(creditFor(org, { quantity: 6 })), {
        code: "SEAT_CREDIT_CONFLICT",
      });
      assert.equal((await SeatPool.findById(pool._id)).totalSeats, 13);
    },
  );

  await t.test(
    "quantity validation and missing organizations never create capacity",
    async () => {
      const org = await createOrganization();
      for (const quantity of [
        0,
        -1,
        1.5,
        "5",
        NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        await assert.rejects(addSeats(creditFor(org, { quantity })), {
          code: "INVALID_SEAT_CREDIT",
        });
      }
      await assert.rejects(addSeats(creditFor(org, { referenceId: " " })), {
        code: "INVALID_SEAT_CREDIT",
      });
      await assert.rejects(
        addSeats(
          creditFor(org, { organizationId: new mongoose.Types.ObjectId() }),
        ),
        { code: "ORGANIZATION_NOT_FOUND" },
      );
      assert.equal(await SeatPool.countDocuments(), 0);
      assert.equal(await SeatCredit.countDocuments(), 0);
    },
  );

  await t.test(
    "references are isolated by organization and source",
    async () => {
      const first = await createOrganization();
      const second = await createOrganization();
      await addSeats(creditFor(first));
      await addSeats(creditFor(first, { source: "stripe", quantity: 2 }));
      await addSeats(creditFor(second, { quantity: 9 }));
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(first._id)).totalSeats,
        7,
      );
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(second._id)).totalSeats,
        9,
      );
      assert.equal(await SeatCredit.countDocuments(), 3);
    },
  );

  await t.test(
    "simultaneous first grants, duplicate deliveries, and pool readers share one pool",
    async () => {
      const org = await createOrganization();
      const results = await Promise.all([
        ...Array.from({ length: 6 }, () => addSeats(creditFor(org))),
        ...Array.from({ length: 4 }, (_, i) =>
          addSeats(
            creditFor(org, {
              referenceId: `cs_${i}`,
              source: "stripe",
              quantity: 2,
            }),
          ),
        ),
        ...Array.from({ length: 3 }, () =>
          SeatPool.findOrCreateOrgSeatPool(org),
        ),
      ]);
      assert.equal(
        results.filter((result) => result.duplicate === false).length,
        5,
      );
      assert.equal(await SeatPool.countDocuments({ organization: org._id }), 1);
      assert.equal(
        await SeatCredit.countDocuments({ organization: org._id }),
        5,
      );
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        13,
      );
    },
  );

  await t.test(
    "manual pools share the active uniqueness constraint; historical pools are retained",
    async () => {
      const org = await createOrganization();
      await createSeatPool(org._id, { status: "expired", totalSeats: 7 });
      const manual = await createSeatPool(org._id, {
        status: "manual",
        totalSeats: 2,
      });
      await assert.rejects(createSeatPool(org._id), { code: 11000 });
      const result = await addSeats(creditFor(org));
      assert.equal(String(result.pool._id), String(manual._id));
      assert.equal(result.pool.totalSeats, 7);
      assert.equal(await SeatPool.countDocuments(), 2);
    },
  );

  await t.test(
    "a failed balance increment rolls back the new pool and credit",
    async (t) => {
      const org = await createOrganization();
      const original = SeatPool.findOneAndUpdate.bind(SeatPool);
      const update = t.mock.method(
        SeatPool,
        "findOneAndUpdate",
        (filter, changes, options) => {
          if (changes.$inc) throw new Error("simulated balance failure");
          return original(filter, changes, options);
        },
      );
      await assert.rejects(
        addSeats(creditFor(org)),
        /simulated balance failure/,
      );
      assert.equal(await SeatPool.countDocuments(), 0);
      assert.equal(await SeatCredit.countDocuments(), 0);
      update.mock.restore();
      await addSeats(creditFor(org));
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        5,
      );
    },
  );

  await t.test(
    "Clerk creation, updates, and old event replays add each distinct grant once",
    async (t) => {
      t.mock.method(
        ClassroomTemplate,
        "copyGlobalToOrganization",
        async () => {},
      );
      const data = clerkData("org_credit_webhook", {
        id: "fall",
        quantity: 50,
      });
      assert.equal(
        (await deliverClerk("organization.created", data)).statusCode,
        200,
      );
      const org = await Organization.findByClerkId(data.id);
      const spring = {
        ...data,
        name: "Renamed",
        private_metadata: { seatGrant: { id: "spring", quantity: 20 } },
      };
      for (const [type, event] of [
        ["organization.created", data],
        ["organization.updated", data],
        ["organization.updated", spring],
        ["organization.updated", data],
        ["organization.updated", { ...data, private_metadata: {} }],
      ]) {
        assert.equal((await deliverClerk(type, event)).statusCode, 200);
      }
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        70,
      );
      assert.equal(await SeatCredit.countDocuments(), 2);
    },
  );

  await t.test(
    "Clerk creation credits a preexisting organization and updates can create one",
    async () => {
      const org = await createOrganization({
        clerkOrganizationId: "org_preexisting",
      });
      const grant = { id: "promotion", quantity: 3 };
      assert.equal(
        (
          await deliverClerk(
            "organization.created",
            clerkData(org.clerkOrganizationId, grant),
          )
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await deliverClerk(
            "organization.updated",
            clerkData("org_update_first", grant),
          )
        ).statusCode,
        200,
      );
      assert.equal(await SeatCredit.countDocuments(), 2);
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        3,
      );
    },
  );

  await t.test(
    "simultaneous Clerk creation and update deliveries provision and credit once",
    async (t) => {
      t.mock.method(
        ClassroomTemplate,
        "copyGlobalToOrganization",
        async () => {},
      );
      const data = clerkData("org_simultaneous", {
        id: "welcome",
        quantity: 8,
      });
      const responses = await Promise.all([
        deliverClerk("organization.created", data),
        deliverClerk("organization.created", data),
        deliverClerk("organization.updated", data),
      ]);
      assert.ok(responses.every((response) => response.statusCode === 200));
      const org = await Organization.findByClerkId(data.id);
      assert.equal(await Organization.countDocuments(), 1);
      assert.equal(await SeatCredit.countDocuments(), 1);
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        8,
      );
    },
  );

  await t.test(
    "invalid, public, and conflicting Clerk metadata never changes seats",
    async (t) => {
      const warning = t.mock.method(console, "warn", () => {});
      const org = await createOrganization();
      const data = clerkData(org.clerkOrganizationId, {
        id: "fall",
        quantity: 5,
      });
      assert.equal(
        (await deliverClerk("organization.updated", data)).statusCode,
        200,
      );
      for (const grant of [
        { id: "fall", quantity: 10 },
        { id: "bad", quantity: "8" },
        {},
        false,
      ]) {
        assert.equal(
          (
            await deliverClerk("organization.updated", {
              ...data,
              private_metadata: { seatGrant: grant },
            })
          ).statusCode,
          200,
        );
      }
      assert.equal(
        (
          await deliverClerk("organization.updated", {
            ...data,
            private_metadata: {},
            public_metadata: { seatGrant: { id: "public", quantity: 100 } },
          })
        ).statusCode,
        200,
      );
      assert.equal(warning.mock.callCount(), 4);
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        5,
      );
    },
  );

  await t.test(
    "database failures fail Clerk delivery and retry credits the already-saved organization",
    async (t) => {
      t.mock.method(console, "error", () => {});
      const org = await createOrganization();
      const data = clerkData(org.clerkOrganizationId, {
        id: "retry",
        quantity: 3,
      });
      const create = t.mock.method(SeatCredit, "create", async () => {
        throw new Error("database unavailable");
      });
      assert.equal(
        (await deliverClerk("organization.updated", data)).statusCode,
        500,
      );
      assert.equal(await SeatPool.countDocuments(), 0);
      create.mock.restore();
      assert.equal(
        (await deliverClerk("organization.updated", data)).statusCode,
        200,
      );
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        3,
      );
    },
  );

  await t.test(
    "backend provisioning and Clerk sync share grants; dry runs write nothing",
    async (t) => {
      const { clerkClient } = require("@clerk/express");
      t.mock.method(
        Object.getPrototypeOf(clerkClient.organizations),
        "getOrganization",
        async () => ({
          id: "org_provisioned",
          name: "Professor",
          slug: "professor",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          privateMetadata: { seatGrant: { id: "provisioned", quantity: 7 } },
        }),
      );
      const org = await Organization.ensureByClerkId("org_provisioned");
      await Organization.ensureByClerkId("org_provisioned");
      const clerkOrgs = [
        {
          id: org.clerkOrganizationId,
          privateMetadata: { seatGrant: { id: "synced", quantity: 2 } },
        },
      ];
      const byClerk = new Map([[org.clerkOrganizationId, org]]);
      await applyOrganizationSeatGrants(clerkOrgs, byClerk, { dryRun: true });
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        7,
      );
      assert.equal(await SeatCredit.countDocuments(), 1);
      await applyOrganizationSeatGrants(clerkOrgs, byClerk);
      await applyOrganizationSeatGrants(clerkOrgs, byClerk);
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        9,
      );
      assert.equal(await SeatCredit.countDocuments(), 2);
    },
  );

  await t.test(
    "backend provisioning retries a credit after the organization was already saved",
    async (t) => {
      const { clerkClient } = require("@clerk/express");
      const fetch = t.mock.method(
        Object.getPrototypeOf(clerkClient.organizations),
        "getOrganization",
        async () => ({
          id: "org_retry_provisioning",
          name: "Retry",
          slug: "retry",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          privateMetadata: { seatGrant: { id: "welcome", quantity: 3 } },
        }),
      );
      const create = t.mock.method(SeatCredit, "create", async () => {
        throw new Error("credit database failed");
      });
      await assert.rejects(
        Organization.ensureByClerkId("org_retry_provisioning"),
        /credit database failed/,
      );
      assert.equal(await Organization.countDocuments(), 1);
      assert.equal(await SeatCredit.countDocuments(), 0);
      create.mock.restore();
      const org = await Organization.ensureByClerkId("org_retry_provisioning");
      assert.equal(fetch.mock.callCount(), 1);
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        3,
      );
    },
  );

  await t.test(
    "concurrent Stripe deliveries and a Clerk grant credit the same pool once per reference",
    async () => {
      const org = await createOrganization();
      const checkout = checkoutFor(org);
      await Promise.all([
        ...Array.from({ length: 5 }, () =>
          processCheckoutSessionCompleted(checkout),
        ),
        applyClerkSeatGrant({
          organizationId: org._id,
          privateMetadata: { seatGrant: { id: "promotion", quantity: 6 } },
        }),
      ]);
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        10,
      );
      assert.equal(await SeatCredit.countDocuments(), 2);
      assert.equal(await StripeCheckoutRecord.countDocuments(), 1);
      assert.equal((await StripeCheckoutRecord.findOne()).status, "completed");
      assert.equal(
        (await processCheckoutSessionCompleted(checkout)).duplicate,
        true,
      );
    },
  );

  await t.test(
    "Stripe retries finish completion after a committed credit without adding seats",
    async (t) => {
      const org = await createOrganization();
      const checkout = checkoutFor(org);
      const complete = t.mock.method(
        StripeCheckoutRecord,
        "findByIdAndUpdate",
        async () => {
          throw new Error("completion write failed");
        },
      );
      await assert.rejects(
        processCheckoutSessionCompleted(checkout),
        /completion write failed/,
      );
      assert.equal((await StripeCheckoutRecord.findOne()).status, "processing");
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        4,
      );
      complete.mock.restore();
      await processCheckoutSessionCompleted(checkout);
      assert.equal((await StripeCheckoutRecord.findOne()).status, "completed");
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        4,
      );
      assert.equal(await SeatCredit.countDocuments(), 1);
    },
  );

  await t.test(
    "legacy completed Stripe purchases are never credited again",
    async () => {
      const org = await createOrganization();
      await createSeatPool(org._id, { totalSeats: 12, usedSeats: 2 });
      await StripeCheckoutRecord.create({
        organization: org._id,
        stripeSessionId: "cs_test_seats",
        type: "org_seats",
        quantity: 4,
        status: "completed",
        createdBy: "legacy",
        updatedBy: "legacy",
      });
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          processCheckoutSessionCompleted(checkoutFor(org)),
        ),
      );
      assert.ok(results.every((result) => result.duplicate));
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        12,
      );
      assert.equal(await SeatCredit.countDocuments(), 0);
    },
  );

  await t.test(
    "invalid Stripe quantities never create a checkout record or credit",
    async () => {
      const org = await createOrganization();
      for (const quantity of ["0", "-1", "1.5", "bad", undefined]) {
        const checkout = checkoutFor(org);
        checkout.metadata.quantity = quantity;
        await assert.rejects(
          processCheckoutSessionCompleted(checkout),
          /positive integer/,
        );
      }
      assert.equal(await StripeCheckoutRecord.countDocuments(), 0);
      assert.equal(await SeatCredit.countDocuments(), 0);
      assert.equal(await SeatPool.countDocuments(), 0);
    },
  );

  await t.test(
    "student purchases still create and replay individual claims without an org credit",
    async () => {
      const org = await createOrganization();
      const classroom = await createClassroom(org._id);
      const member = await createMember();
      const checkout = checkoutFor(org, {
        metadata: {
          type: "student_seat",
          organizationId: String(org._id),
          classroomId: String(classroom._id),
          purchaserUserId: String(member._id),
        },
      });
      const result = await processCheckoutSessionCompleted(checkout);
      assert.equal(result.claim.source, "stripe_student");
      assert.equal(
        (await processCheckoutSessionCompleted(checkout)).duplicate,
        true,
      );
      assert.equal(await SeatClaim.countDocuments(), 1);
      assert.equal(await SeatCredit.countDocuments(), 0);
    },
  );

  await t.test(
    "promotional seats support reservations, enrollment, exhaustion, and reuse",
    async () => {
      const org = await createOrganization();
      const classroom = await createClassroom(org._id);
      const first = await createMember();
      const second = await createMember();
      const third = await createMember();
      await addSeats(creditFor(org, { quantity: 2 }));
      const reservedEmail = "reserved-student@example.com";
      await OrgSeatReservation.createReservation({
        organization: org,
        email: reservedEmail,
        createdBy: "test",
      });
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).floatingAvailable,
        1,
      );
      const join = (member) =>
        SeatClaim.claimSeatOrRequireCheckout({
          classroom,
          organization: org,
          member,
          clerkUserId: member.clerkUserId,
          studentEmail: member === first ? reservedEmail : undefined,
        });
      const reserved = await join(first);
      assert.equal(reserved.claim.source, "org_reserved");
      const floating = await join(second);
      assert.equal(floating.claim.source, "org_prepaid");
      const enrollment = await Enrollment.enrollUser(
        classroom._id,
        second._id,
        "member",
        org._id,
        second.clerkUserId,
      );
      assert.ok(enrollment._id);
      await assert.rejects(join(third), { code: "PAYMENT_REQUIRED" });
      await SeatClaim.releaseSeatOnRemoval({
        classroomId: classroom._id,
        userId: second._id,
        organizationId: org._id,
        updatedBy: "test",
      });
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).floatingAvailable,
        1,
      );
      assert.equal((await join(third)).claim.source, "org_prepaid");
      assert.equal(
        (await SeatPool.getBillingSummary({ organization: org, user: first }))
          .orgSeatSummary.totalSeats,
        2,
      );
    },
  );

  await t.test(
    "preflight distinguishes ambiguous historical purchases from retryable credited ones",
    async () => {
      const org = await createOrganization();
      assert.equal((await auditSeatCredits(mongoose.connection)).ready, true);
      await StripeCheckoutRecord.create({
        organization: org._id,
        stripeSessionId: "cs_audit",
        type: "org_seats",
        quantity: 4,
        status: "processing",
        createdBy: "test",
        updatedBy: "test",
      });
      const ambiguous = await auditSeatCredits(mongoose.connection);
      assert.equal(ambiguous.ready, false);
      assert.equal(ambiguous.requiresReconciliation.length, 1);
      await addSeats(
        creditFor(org, {
          source: "stripe",
          referenceId: "cs_audit",
          quantity: 4,
        }),
      );
      const retryable = await auditSeatCredits(mongoose.connection);
      assert.equal(retryable.ready, true);
      assert.equal(retryable.requiresReconciliation.length, 0);
      assert.equal(retryable.retryableCreditedPurchases.length, 1);
      assert.equal(
        (await SeatPool.getOrgSeatAvailability(org._id)).totalSeats,
        4,
      );
    },
  );

  await t.test(
    "preflight reports duplicate active pools without repairing balances",
    async () => {
      const org = await createOrganization();
      await SeatPool.collection.dropIndex("unique_active_org_seat_pool");
      try {
        await createSeatPool(org._id, { totalSeats: 3 });
        await createSeatPool(org._id, { totalSeats: 7, status: "manual" });
        const report = await auditSeatCredits(mongoose.connection);
        assert.equal(report.ready, false);
        assert.equal(report.duplicateActivePools.length, 1);
        assert.equal(await SeatPool.countDocuments(), 2);
      } finally {
        await SeatPool.deleteMany({ organization: org._id });
        await SeatPool.createIndexes();
      }
    },
  );

  await t.test(
    "preflight catches duplicate active reservations before the corrected index is built",
    async () => {
      const org = await createOrganization();
      await OrgSeatReservation.collection.dropIndex("organization_1_email_1");
      try {
        await OrgSeatReservation.create([
          {
            organization: org._id,
            email: "duplicate@example.com",
            status: "reserved",
            createdBy: "test",
            updatedBy: "test",
          },
          {
            organization: org._id,
            email: "duplicate@example.com",
            status: "claimed",
            createdBy: "test",
            updatedBy: "test",
          },
        ]);
        const report = await auditSeatCredits(mongoose.connection);
        assert.equal(report.ready, false);
        assert.equal(report.duplicateActiveReservations.length, 1);
        assert.equal(await OrgSeatReservation.countDocuments(), 2);
      } finally {
        await OrgSeatReservation.deleteMany({ organization: org._id });
        await OrgSeatReservation.createIndexes();
      }
    },
  );
});
