const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertJoinPolicyAllowed,
  assertRosterAccessAllowed,
  isUnlimitedInviteEnrollment,
} = require("./joinPolicy");

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
    (err) => err.code === "INVITE_REQUIRED"
  );
});

test("invite_link policy allows invite link join path", () => {
  assert.doesNotThrow(() =>
    assertJoinPolicyAllowed({
      classroom: mockClassroom,
      organization: mockOrganization,
      joinPolicy: "invite_link",
      joinSource: "invite_link",
    })
  );
});

test("open policy allows classroom list self-join", () => {
  assert.doesNotThrow(() =>
    assertJoinPolicyAllowed({
      classroom: mockClassroom,
      organization: mockOrganization,
      joinPolicy: "open",
      joinSource: "classroom_list",
    })
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
    (err) => err.code === "CLASSROOM_CLOSED"
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
    (err) => err.code === "ROSTER_ONLY"
  );
});

test("access policy blocks join before seat entitlement is evaluated", () => {
  assert.throws(
    () =>
      assertRosterAccessAllowed({
        classroom: { ...mockClassroom, allowAnonymousJoin: false },
        rosterSeat: null,
        joinPolicy: "roster_only",
      }),
    (err) => err.code === "ROSTER_ONLY"
  );
});

test("roster seat satisfies roster_only access check", () => {
  assert.doesNotThrow(() =>
    assertRosterAccessAllowed({
      classroom: mockClassroom,
      rosterSeat: { _id: "rs1", email: "student@example.com" },
      joinPolicy: "roster_only",
    })
  );
});

test("only Anyone with link is an unlimited enrollment policy", () => {
  assert.equal(
    isUnlimitedInviteEnrollment({
      joinPolicy: "invite_link",
      allowAnonymousJoin: true,
    }),
    true,
  );
  assert.equal(
    isUnlimitedInviteEnrollment({
      joinPolicy: "invite_link",
      allowAnonymousJoin: false,
    }),
    false,
  );
  assert.equal(
    isUnlimitedInviteEnrollment({
      joinPolicy: "open",
      allowAnonymousJoin: true,
    }),
    false,
  );
});
