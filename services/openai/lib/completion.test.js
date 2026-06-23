const test = require("node:test");
const assert = require("node:assert/strict");

test("openai completion lib exports function", () => {
  const completion = require("./completion");
  assert.equal(typeof completion, "function");
});
