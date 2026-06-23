const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
} = require("../../test/helpers/db");
const controller = require("./enrollment.controller");

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

test("enrollment controller exports handlers", () => {
  assert.equal(typeof controller.joinClass, "function");
  assert.equal(typeof controller.getClassRoster, "function");
  assert.equal(typeof controller.leaveClass, "function");
  assert.equal(typeof controller.transferStudent, "function");
  assert.equal(typeof controller.removeStudent, "function");
  assert.equal(typeof controller.exportRoster, "function");
});

test("joinClass returns 404 when class not found", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  const mongoose = require("mongoose");
  const res = mockRes();

  await controller.joinClass(
    {
      params: { classroomId: new mongoose.Types.ObjectId().toString() },
      body: {},
      clerkUser: { id: "user_missing" },
    },
    res
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "Class not found");
});
