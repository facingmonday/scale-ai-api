const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PLAN_KEYS,
  PLAN_CATALOG,
  getPlan,
  getDefaultFreeTeacherLimits,
} = require("../services/licensing/planCatalog");

test("licensing plan catalog defines org and student plans", () => {
  assert.ok(PLAN_CATALOG[PLAN_KEYS.ORG_SEATS]);
  assert.ok(PLAN_CATALOG[PLAN_KEYS.STUDENT_CLASS_PASS]);
  assert.equal(PLAN_CATALOG[PLAN_KEYS.ORG_SEATS].features.stripeCheckout, true);
});

test("getPlan returns null for unknown plans", () => {
  assert.equal(getPlan("does_not_exist"), null);
});

test("free teacher limits are conservative by default", () => {
  const limits = getDefaultFreeTeacherLimits();
  assert.equal(limits.planKey, "free_teacher_workspace");
  assert.equal(typeof limits.classroomLimit, "number");
  assert.equal(limits.classroomLimit > 0, true);
});

test("student seat plan is per enrollment", () => {
  const plan = getPlan(PLAN_KEYS.STUDENT_CLASS_PASS);
  assert.equal(plan.purchaserScope, "user");
  assert.equal(plan.features.perEnrollment, true);
});

const {
  assertJoinPolicyAllowed,
  assertRosterAccessAllowed,
} = require("../services/licensing/joinPolicy");

const classroomId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const mockClassroom = { _id: classroomId, allowAnonymousJoin: true };
const mockOrganization = { _id: organizationId };

test("invite_link policy blocks classroom list self-join before seat checks", () => {
  assert.throws(
    () =>
      assertJoinPolicyAllowed({
        classroom: mockClassroom,
        organization: mockOrganization,
        joinPolicy: "invite_link",
        joinSource: "classroom_list",
      }),
    (err) => err.code === "INVITE_REQUIRED",
  );
});

test("invite_link policy allows invite link join path", () => {
  assert.doesNotThrow(() =>
    assertJoinPolicyAllowed({
      classroom: mockClassroom,
      organization: mockOrganization,
      joinPolicy: "invite_link",
      joinSource: "invite_link",
    }),
  );
});

test("open policy allows classroom list self-join", () => {
  assert.doesNotThrow(() =>
    assertJoinPolicyAllowed({
      classroom: mockClassroom,
      organization: mockOrganization,
      joinPolicy: "open",
      joinSource: "classroom_list",
    }),
  );
});

test("closed policy blocks all join paths", () => {
  assert.throws(
    () =>
      assertJoinPolicyAllowed({
        classroom: mockClassroom,
        organization: mockOrganization,
        joinPolicy: "closed",
        joinSource: "invite_link",
      }),
    (err) => err.code === "CLASSROOM_CLOSED",
  );
});

test("roster_only policy requires roster seat when anonymous join is allowed", () => {
  assert.throws(
    () =>
      assertRosterAccessAllowed({
        classroom: mockClassroom,
        rosterSeat: null,
        joinPolicy: "roster_only",
      }),
    (err) => err.code === "ROSTER_ONLY",
  );
});
