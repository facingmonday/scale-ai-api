const test = require("node:test");
const assert = require("node:assert/strict");
const { handleClerkWebhook } = require("./clerk/clerk.controller");

test("clerk webhook controller exports handler", () => {
  assert.equal(typeof handleClerkWebhook, "function");
});
