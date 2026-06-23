const test = require("node:test");
const assert = require("node:assert/strict");
const helpers = require("./workers.helpers");

test("workers helpers exports utilities", () => {
  assert.equal(typeof helpers, "object");
});
