const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./openai.controller");

test("openai.controller exports handlers", () => {
  assert.equal(typeof controller.completion, "function");
});
