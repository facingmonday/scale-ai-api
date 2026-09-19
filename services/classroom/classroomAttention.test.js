const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Classroom = require("./classroom.model");
const attention = require("./classroomAttention.service");
const controller = require("./classroomAttention.controller");

const classroomId = new mongoose.Types.ObjectId().toString();
const organizationId = new mongoose.Types.ObjectId().toString();
const now = new Date("2026-09-15T12:00:00Z");
const enrollment = (id, overrides = {}) => ({
  userId: { _id: id, firstName: `Student ${id}` }, joinedAt: new Date("2026-09-01"), ...overrides,
});
const profile = (userId) => ({ userId, shopName: "Shop", profileType: "type" });
const challenges = [1, 2, 3, 4, 5].map((day) => ({
  _id: String(day), title: `Challenge ${day}`, reviewAt: new Date(`2026-09-${10 + day}`),
}));
const report = (overrides = {}) => attention.buildReport({
  classroomId, now, enrollments: [enrollment("one")], challenges, decisions: [],
  profiles: [profile("one")], claims: [], ...overrides,
});

test("manual and legacy decisions count as participation; all automatic methods remain missed", () => {
  for (const method of ["AI", "FORWARDED_PREVIOUS", "AI_FALLBACK", "DEFAULTS"]) {
    const result = report({ decisions: challenges.map((challenge, index) => ({
      userId: "one", challengeId: challenge._id,
      ...(index === 0 ? {} : { generation: { method: index === 1 ? "MANUAL" : method } }),
    })) });
    assert.equal(result.students[0].missedCount, 3);
    assert.equal(result.counts.submissions, 1);
    assert.match(result.students[0].issues[0].detail, /Challenge 3, Challenge 4, Challenge 5/);
  }
});

test("one missing submission does not trigger repeated-miss flag", () => {
  assert.equal(report({ decisions: challenges.slice(1).map((challenge) => ({
    userId: "one", challengeId: challenge._id, generation: { method: "MANUAL" },
  })) }).counts.all, 0);
});

test("new students are not flagged for deadlines before joining or unknown enrollment dates", () => {
  for (const joinedAt of [new Date("2026-09-14"), new Date("2026-09-16"), null, "invalid"]) {
    assert.equal(report({ enrollments: [enrollment("one", { joinedAt })] }).counts.submissions, 0);
  }
});

test("setup detects absent and incomplete profiles without requiring optional student IDs", () => {
  for (const profiles of [[], [{ userId: "one", shopName: " " }], [{ userId: "one", shopName: "Shop" }]]) {
    assert.equal(report({ challenges: [], profiles }).counts.setup, 1);
  }
  assert.equal(report({ challenges: [] }).counts.all, 0);
});

test("seat review requires recorded inactive claims and ignores historical inactivity when an active claim exists", () => {
  for (const status of ["held", "revoked", "expired"]) {
    const result = report({ challenges: [], claims: [{ userId: "one", status }] });
    assert.equal(result.counts.access, 1);
    assert.match(result.students[0].issues[0].detail, new RegExp(status));
    assert.equal(result.students[0].issues[0].href, `/classroom/${classroomId}?tab=classAccess`);
    assert.equal(report({ challenges: [], claims: [
      { userId: "one", status }, { userId: "one", status: "active" },
    ] }).counts.access, 0);
  }
  assert.equal(report({ challenges: [], claims: [] }).counts.access, 0);
  assert.equal(report({ challenges: [], claims: [{ userId: "one" }] }).counts.access, 0);
});

test("students are counted once across categories and highest issue counts come first", () => {
  const result = report({
    enrollments: [enrollment("one"), enrollment("two"), enrollment("removed-member", { userId: null })],
    profiles: [profile("one")], claims: [{ userId: "two", status: "expired" }],
  });
  assert.deepEqual(result.counts, { all: 2, submissions: 2, setup: 1, access: 1 });
  assert.equal(result.totalEnrolled, 2);
  assert.equal(result.students[0].studentId, "two");
  assert.equal(result.students[0].href, `/students/two?classroomId=${classroomId}`);
});

function req(id = classroomId) {
  return { params: { classroomId: id }, organization: { _id: organizationId }, clerkUser: { id: "teacher" } };
}
function res() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test("teacher classroom access is checked before data is read", async (t) => {
  let authorized = false;
  t.mock.method(Classroom, "validateAdminAccess", async (...args) => {
    assert.deepEqual(args, [classroomId, "teacher", organizationId]);
    authorized = true;
  });
  t.mock.method(attention, "getClassroomAttention", async (options) => {
    assert.equal(authorized, true);
    assert.deepEqual(options, { classroomId, organizationId });
    return { students: [] };
  });
  const response = res();
  await controller.getClassroomAttention(req(), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { students: [] });
});

for (const [message, status] of [["Insufficient permissions: Admin access required", 403], ["Class not found", 404]]) {
  test(`denied classroom access (${status}) never loads student data`, async (t) => {
    t.mock.method(Classroom, "validateAdminAccess", async () => { throw new Error(message); });
    const read = t.mock.method(attention, "getClassroomAttention", async () => assert.fail("Unauthorized read"));
    const response = res();
    await controller.getClassroomAttention(req(), response);
    assert.equal(response.statusCode, status);
    assert.equal(read.mock.callCount(), 0);
  });
}

test("invalid IDs return 400 before authorization", async (t) => {
  const access = t.mock.method(Classroom, "validateAdminAccess", async () => assert.fail("Invalid ID"));
  for (const value of ["bad", "", { $ne: null }, [classroomId]]) {
    const response = res();
    await controller.getClassroomAttention(req(value), response);
    assert.equal(response.statusCode, 400);
  }
  assert.equal(access.mock.callCount(), 0);
});

test("unexpected failures return an unavailable state without exposing database details", async (t) => {
  t.mock.method(Classroom, "validateAdminAccess", async () => {});
  t.mock.method(attention, "getClassroomAttention", async () => { throw new Error("private database details"); });
  t.mock.method(console, "error", () => {});
  const response = res();
  await controller.getClassroomAttention(req(), response);
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: "Needs attention is temporarily unavailable." });
});
