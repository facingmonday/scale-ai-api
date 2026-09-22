const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Classroom = require("./classroom.model");
const service = require("./classroomCalendar.service");
const controller = require("./classroomCalendar.controller");
const classroomId = new mongoose.Types.ObjectId().toString();
const organizationId = new mongoose.Types.ObjectId().toString();
const request = (id = classroomId) => ({ params: { classroomId: id }, organization: { _id: organizationId }, clerkUser: { id: "teacher" } });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test("calendar reminders require classroom authorization before any data read", async (t) => {
  let authorized = false;
  t.mock.method(Classroom, "validateAdminAccess", async (...args) => {
    assert.deepEqual(args, [classroomId, "teacher", organizationId]);
    authorized = true;
  });
  t.mock.method(service, "getCalendarReminders", async (options) => {
    assert.ok(authorized);
    assert.deepEqual(options, { classroomId, organizationId });
    return [];
  });
  const res = response();
  await controller.getCalendarReminders(request(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { reminders: [] });
});

for (const [error, status] of [["Insufficient permissions", 403], ["Class not found", 404]]) {
  test(`unauthorized reminder reads return ${status}`, async (t) => {
    t.mock.method(Classroom, "validateAdminAccess", async () => { throw new Error(error); });
    const read = t.mock.method(service, "getCalendarReminders", async () => assert.fail("Must not read reminders"));
    const res = response();
    await controller.getCalendarReminders(request(), res);
    assert.equal(res.statusCode, status);
    assert.equal(read.mock.callCount(), 0);
  });
}

test("invalid calendar IDs are rejected before querying", async (t) => {
  const access = t.mock.method(Classroom, "validateAdminAccess", async () => assert.fail("Invalid ID"));
  for (const id of ["bad", { $ne: null }, [classroomId]]) {
    const res = response();
    await controller.getCalendarReminders(request(id), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(access.mock.callCount(), 0);
});

test("calendar failure returns a generic error rather than an empty schedule", async (t) => {
  t.mock.method(Classroom, "validateAdminAccess", async () => {});
  t.mock.method(service, "getCalendarReminders", async () => { throw new Error("Private database error"); });
  t.mock.method(console, "error", () => {});
  const res = response();
  await controller.getCalendarReminders(request(), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "Scheduled reminders are temporarily unavailable." });
});
