const test = require("node:test");
const assert = require("node:assert/strict");

const { makeTransferError } = require("../services/enrollment/transfer.errors");
const {
  isStudentPaidSource,
  isOrgPaidSource,
} = require("../services/licensing/seatLifecycle.service");

test("makeTransferError includes status code and error code", () => {
  const err = makeTransferError("Cannot transfer", 409, "ALREADY_ENROLLED", {
    userId: "abc",
  });

  assert.equal(err.message, "Cannot transfer");
  assert.equal(err.statusCode, 409);
  assert.equal(err.code, "ALREADY_ENROLLED");
  assert.deepEqual(err.details, { userId: "abc" });
});

test("transfer service shares seat source helpers with lifecycle service", () => {
  assert.equal(isStudentPaidSource("stripe_student"), true);
  assert.equal(isOrgPaidSource("org_prepaid"), true);
});
