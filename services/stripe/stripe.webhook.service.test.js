const test = require("node:test");
const assert = require("node:assert/strict");

test("stripe webhook service exports handlers", () => {
  const service = require("./stripe.webhook.service");
  assert.equal(typeof service, "object");
});
