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

const controller = require("./join.controller");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("join controller", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await t.test("returns 401 without authenticated member", async () => {
    const res = mockRes();
    await controller.join({ body: {}, clerkUser: null, user: null }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
  });

  await t.test("returns 400 when orgId or classroomId missing", async () => {
    const res = mockRes();
    await controller.join(
      {
        body: {},
        clerkUser: { id: "user_1" },
        user: { _id: "member_1" },
      },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  });

  await t.test("successful join returns enrollment data", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_ctrl" });
    const classroom = await createClassroom(org._id, { joinPolicy: "open" });
    const member = await createMember({ clerkUserId: "user_join_ctrl" });
    const restoreClerk = stubClerkMembership(Member);
    await createSeatPool(org._id, { totalSeats: 5 });

    const res = mockRes();
    await controller.join(
      {
        body: { orgId: org.clerkOrganizationId, classroomId: classroom._id },
        clerkUser: {
          id: member.clerkUserId,
          primaryEmailAddressId: "email_1",
          emailAddresses: [{ id: "email_1", emailAddress: member.email }],
        },
        user: member,
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.enrollmentId);

    const enrollment = await Enrollment.findByClassAndUser(
      classroom._id,
      member._id
    );
    assert.ok(enrollment);
    restoreClerk();
  });

  await t.test("returns payment required without logging an application error", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_payment_ctrl" });
    const classroom = await createClassroom(org._id, {
      joinPolicy: "open",
      studentPaysAllowed: true,
    });
    const member = await createMember({ clerkUserId: "user_join_payment_ctrl" });
    const restoreClerk = stubClerkMembership(Member);
    await createSeatPool(org._id, { totalSeats: 0, usedSeats: 0 });
    const originalConsoleError = console.error;
    const loggedErrors = [];
    console.error = (...args) => loggedErrors.push(args);

    try {
      const res = mockRes();
      await controller.join(
        {
          body: { orgId: org.clerkOrganizationId, classroomId: classroom._id },
          clerkUser: {
            id: member.clerkUserId,
            primaryEmailAddressId: "email_payment",
            emailAddresses: [
              {
                id: "email_payment",
                emailAddress: "payment.student@example.com",
              },
            ],
          },
          user: member,
        },
        res,
      );

      assert.equal(res.statusCode, 402);
      assert.equal(res.body.code, "PAYMENT_REQUIRED");
      assert.equal(loggedErrors.length, 0);
    } finally {
      console.error = originalConsoleError;
      restoreClerk();
    }
  });
});
