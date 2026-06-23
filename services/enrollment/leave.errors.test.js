const test = require("node:test");
const assert = require("node:assert/strict");
const { makeLeaveError } = require("./leave.errors");

test("makeLeaveError includes status code and error code", () => {
  const err = makeLeaveError("Not enrolled", 404, "NOT_ENROLLED");

  assert.equal(err.message, "Not enrolled");
  assert.equal(err.statusCode, 404);
  assert.equal(err.code, "NOT_ENROLLED");
});
