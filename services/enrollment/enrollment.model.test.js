const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
} = require("../../test/helpers/db");
const { stubClerkMembership } = require("../../test/helpers/clerk");
const {
  createOrganization,
  createClassroom,
  createMember,
  createSeatPool,
} = require("../../test/helpers/factories");
const { assertRejectsWithCode } = require("../../test/helpers/assertErrors");

const Enrollment = require("./enrollment.model");
const Member = require("../members/member.model");
const SeatClaim = require("../licensing/seatClaim.model");

test("enrollment ensureJoin", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await t.test("idempotent re-join returns existing enrollment", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_idempotent" });
    const classroom = await createClassroom(org._id, { joinPolicy: "open" });
    const member = await createMember({ clerkUserId: "user_idempotent" });
    const restoreClerk = stubClerkMembership(Member);

    await createSeatPool(org._id, { totalSeats: 5 });

    const first = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      joinSource: "invite_link",
    });

    const second = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      joinSource: "invite_link",
    });

    assert.equal(String(first.enrollment._id), String(second.enrollment._id));
    restoreClerk();
  });

  await t.test("org prepaid join creates claim and enrollment", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_prepaid" });
    const classroom = await createClassroom(org._id, { joinPolicy: "open" });
    const member = await createMember({ clerkUserId: "user_prepaid" });
    const restoreClerk = stubClerkMembership(Member);

    await createSeatPool(org._id, { totalSeats: 5 });

    const result = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      joinSource: "invite_link",
    });

    assert.ok(result.enrollment);
    const claim = await SeatClaim.findActiveClaim(classroom._id, member._id);
    assert.ok(claim);
    assert.equal(claim.source, "org_prepaid");
    restoreClerk();
  });

  await t.test("payment required when no seats available", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_payment" });
    const classroom = await createClassroom(org._id, {
      joinPolicy: "open",
      studentPaysAllowed: true,
    });
    const member = await createMember({ clerkUserId: "user_payment" });
    const restoreClerk = stubClerkMembership(Member);

    await createSeatPool(org._id, { totalSeats: 0, usedSeats: 0 });

    await assertRejectsWithCode(
      Enrollment.ensureJoin({
        orgId: org.clerkOrganizationId,
        classroomId: classroom._id,
        clerkUserId: member.clerkUserId,
        member,
        joinSource: "invite_link",
      }),
      "PAYMENT_REQUIRED",
      { statusCode: 402 }
    );
    restoreClerk();
  });

  await t.test("roster_only blocks join without roster seat", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_roster" });
    const classroom = await createClassroom(org._id, {
      joinPolicy: "roster_only",
      allowAnonymousJoin: true,
    });
    const member = await createMember({ clerkUserId: "user_roster" });
    const restoreClerk = stubClerkMembership(Member);

    await assertRejectsWithCode(
      Enrollment.ensureJoin({
        orgId: org.clerkOrganizationId,
        classroomId: classroom._id,
        clerkUserId: member.clerkUserId,
        member,
        joinSource: "invite_link",
      }),
      "ROSTER_ONLY"
    );
    restoreClerk();
  });

  await t.test("classroom not found returns 404", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_404" });
    const member = await createMember({ clerkUserId: "user_404" });
    const restoreClerk = stubClerkMembership(Member);
    const mongoose = require("mongoose");

    await assert.rejects(
      Enrollment.ensureJoin({
        orgId: org.clerkOrganizationId,
        classroomId: new mongoose.Types.ObjectId(),
        clerkUserId: member.clerkUserId,
        member,
      }),
      (err) => err.statusCode === 404
    );
    restoreClerk();
  });
});
