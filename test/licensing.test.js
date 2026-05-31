const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PLAN_KEYS,
  PLAN_CATALOG,
  getPlan,
  getDefaultFreeTeacherLimits,
} = require("../services/licensing/planCatalog");

test("licensing plan catalog defines student, teacher, and enterprise plans", () => {
  assert.equal(
    PLAN_CATALOG[PLAN_KEYS.STUDENT_CLASS_PASS].seatCount,
    1
  );
  assert.equal(
    PLAN_CATALOG[PLAN_KEYS.TEACHER_SEAT_PACK_30].seatCount,
    30
  );
  assert.equal(
    PLAN_CATALOG[PLAN_KEYS.TEACHER_SEAT_PACK_100].seatCount,
    100
  );
  assert.equal(
    PLAN_CATALOG[PLAN_KEYS.INSTITUTION_ENTERPRISE].features.managedBilling,
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
  assert.equal(limits.studentPaysAllowed, true);
});

test("student class pass stays classroom scoped", () => {
  const plan = getPlan(PLAN_KEYS.STUDENT_CLASS_PASS);
  assert.equal(plan.purchaserScope, "user");
  assert.equal(plan.seatPoolScope, "user");
  assert.equal(plan.features.classroomScoped, true);
});
