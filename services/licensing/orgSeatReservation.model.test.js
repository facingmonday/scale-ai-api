const test = require("node:test");
const assert = require("node:assert/strict");
const OrgSeatReservation = require("./orgSeatReservation.model");

const { normalizeEmail } = OrgSeatReservation;

test("normalizeEmail lowercases and trims", () => {
  assert.equal(normalizeEmail("  Student@Example.COM  "), "student@example.com");
});

test("normalizeEmail returns empty string for invalid input", () => {
  assert.equal(normalizeEmail(null), "");
  assert.equal(normalizeEmail(undefined), "");
});
