const test = require("node:test");
const assert = require("node:assert/strict");

const { makeTransferError } = require("../services/enrollment/transfer.errors");

test("makeTransferError includes status code and error code", () => {
  const err = makeTransferError("Cannot transfer", 409, "ALREADY_ENROLLED", {
    userId: "abc",
  });

  assert.equal(err.message, "Cannot transfer");
  assert.equal(err.statusCode, 409);
  assert.equal(err.code, "ALREADY_ENROLLED");
  assert.deepEqual(err.details, { userId: "abc" });
});
