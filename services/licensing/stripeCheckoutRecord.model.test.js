const test = require("node:test");
const assert = require("node:assert/strict");

test("stripeCheckoutRecord model schema exists", () => {
  assert.ok(require("./stripeCheckoutRecord.model").schema);
});
