const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeOrgSeatAvailability,
  normalizeEmail,
} = require("../services/licensing/orgSeatReservation.service");

test("computeOrgSeatAvailability: 50 total, 1 reserved, 0 used => 49 floating", () => {
  const result = computeOrgSeatAvailability({
    totalSeats: 50,
    usedSeats: 0,
    reservedUnclaimed: 1,
  });

  assert.equal(result.floatingAvailable, 49);
  assert.equal(result.remainingSeats, 49);
  assert.equal(result.canReserve, true);
});

test("computeOrgSeatAvailability: full pool has no floating or reserve capacity", () => {
  const result = computeOrgSeatAvailability({
    totalSeats: 10,
    usedSeats: 8,
    reservedUnclaimed: 2,
  });

  assert.equal(result.floatingAvailable, 0);
  assert.equal(result.canReserve, false);
});

test("computeOrgSeatAvailability: used seats reduce floating pool", () => {
  const result = computeOrgSeatAvailability({
    totalSeats: 50,
    usedSeats: 5,
    reservedUnclaimed: 0,
  });

  assert.equal(result.floatingAvailable, 45);
});

test("normalizeEmail lowercases and trims", () => {
  assert.equal(normalizeEmail("  Student@Example.COM  "), "student@example.com");
});

test("normalizeEmail returns empty string for invalid input", () => {
  assert.equal(normalizeEmail(null), "");
  assert.equal(normalizeEmail(undefined), "");
});

const {
  assertJoinPolicyAllowed,
  assertRosterAccessAllowed,
} = require("../services/licensing/joinPolicy");

const classroomId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const mockClassroom = { _id: classroomId, allowAnonymousJoin: true };
const mockOrganization = { _id: organizationId };

test("access policy blocks join before seat entitlement is evaluated", () => {
  assert.throws(
    () =>
      assertRosterAccessAllowed({
        classroom: { ...mockClassroom, allowAnonymousJoin: false },
        rosterSeat: null,
        joinPolicy: "roster_only",
      }),
    (err) => err.code === "ROSTER_ONLY",
  );
});

test("roster seat satisfies roster_only access check", () => {
  assert.doesNotThrow(() =>
    assertRosterAccessAllowed({
      classroom: mockClassroom,
      rosterSeat: { _id: "rs1", email: "student@example.com" },
      joinPolicy: "roster_only",
    }),
  );
});

test("invite_link policy blocks classroom list self-join", () => {
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
