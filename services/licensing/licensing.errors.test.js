const test = require("node:test");
const assert = require("node:assert/strict");
const {
  makeLicensingError,
  makeReservationError,
} = require("./licensing.errors");

test("makeLicensingError includes status code and error code", () => {
  const err = makeLicensingError("Payment required", 402, "PAYMENT_REQUIRED", {
    classroomId: "abc",
  });

  assert.equal(err.message, "Payment required");
  assert.equal(err.statusCode, 402);
  assert.equal(err.code, "PAYMENT_REQUIRED");
  assert.deepEqual(err.details, { classroomId: "abc" });
});

test("makeReservationError includes status code and error code", () => {
  const err = makeReservationError("Not found", 404, "NOT_FOUND");

  assert.equal(err.message, "Not found");
  assert.equal(err.statusCode, 404);
  assert.equal(err.code, "NOT_FOUND");
});
