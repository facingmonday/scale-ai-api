const test = require("node:test");
const assert = require("node:assert/strict");
const SeatClaim = require("./seatClaim.model");

test("isStudentPaidSource identifies student-paid sources", () => {
  assert.equal(SeatClaim.isStudentPaidSource("stripe_student"), true);
  assert.equal(SeatClaim.isStudentPaidSource("student_purchase"), true);
  assert.equal(SeatClaim.isOrgPaidSource("org_prepaid"), true);
  assert.equal(SeatClaim.isOrgPaidSource("org_reserved"), true);
  assert.equal(SeatClaim.isStudentPaidSource("org_prepaid"), false);
});

test("isOrgPaidSource includes grant sources", () => {
  assert.equal(SeatClaim.isOrgPaidSource("manual_comp"), true);
  assert.equal(SeatClaim.isOrgPaidSource("teacher_assigned"), true);
  assert.equal(SeatClaim.isOrgPaidSource("enterprise"), true);
  assert.equal(SeatClaim.isOrgPaidSource("stripe_student"), false);
  assert.equal(SeatClaim.isOrgPaidSource("teacher_open"), false);
});

test("getPrimaryEmail normalizes member email", () => {
  assert.equal(
    SeatClaim.getPrimaryEmail({ email: "  Student@Example.COM  " }),
    "student@example.com"
  );
  assert.equal(SeatClaim.getPrimaryEmail({ maskedEmail: "masked@test.com" }), "masked@test.com");
  assert.equal(SeatClaim.getPrimaryEmail({}), "");
});

test("canRepointStudentClaim allows held claims regardless of enrollments", () => {
  assert.equal(
    SeatClaim.canRepointStudentClaim({
      activeEnrollmentCount: 2,
      claim: { status: "held" },
    }),
    true
  );
});

test("canRepointStudentClaim blocks active orphan repoint when enrolled elsewhere", () => {
  assert.equal(
    SeatClaim.canRepointStudentClaim({
      activeEnrollmentCount: 1,
      claim: { status: "active" },
    }),
    false
  );
});

test("canRepointStudentClaim allows active orphan repoint with zero enrollments", () => {
  assert.equal(
    SeatClaim.canRepointStudentClaim({
      activeEnrollmentCount: 0,
      claim: { status: "active" },
    }),
    true
  );
});

test("ORG_PAID_SOURCES and STUDENT_PAID_SOURCES are exported", () => {
  assert.deepEqual(SeatClaim.ORG_PAID_SOURCES, ["org_prepaid", "org_reserved"]);
  assert.deepEqual(SeatClaim.STUDENT_PAID_SOURCES, [
    "stripe_student",
    "student_purchase",
  ]);
});
