const test = require("node:test");
const assert = require("node:assert/strict");

const Member = require("./member.model");

test("member model exports clerk sync statics", () => {
  assert.equal(typeof Member.getExistingClerkOrgMembership, "function");
  assert.equal(typeof Member.getOrCreateClerkOrgMembership, "function");
  assert.equal(typeof Member.syncOrgMembership, "function");
  assert.equal(typeof Member.maskEmail, "function");
});

test("maskEmail masks local part", () => {
  assert.equal(Member.maskEmail("student@example.com"), "s****@example.com");
});
