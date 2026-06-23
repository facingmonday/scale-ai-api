const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./outcome.controller");

test("outcome controller exports handlers", () => {
  assert.equal(typeof controller.setScenarioOutcome, "function");
});
