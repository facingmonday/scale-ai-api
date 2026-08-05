const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PLAN_KEYS,
  PLAN_CATALOG,
  getPlan,
  getDefaultFreeTeacherLimits,
} = require("./planCatalog");

test("plan catalog defines org and student plans", () => {
  assert.ok(PLAN_CATALOG[PLAN_KEYS.ORG_SEATS]);
  assert.ok(PLAN_CATALOG[PLAN_KEYS.STUDENT_CLASS_PASS]);
  assert.equal(PLAN_CATALOG[PLAN_KEYS.ORG_SEATS].features.stripeCheckout, true);
  assert.equal(PLAN_CATALOG[PLAN_KEYS.ORG_SEATS].purchaserScope, "organization");
  assert.equal(
    PLAN_CATALOG[PLAN_KEYS.STUDENT_CLASS_PASS].features.perEnrollment,
    true
  );
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
