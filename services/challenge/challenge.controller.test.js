const test = require("node:test");
const assert = require("node:assert/strict");

const controller = require("./challenge.controller");

test("challenge controller exports handlers", () => {
  assert.equal(typeof controller.getScenarios, "function");
  assert.equal(typeof controller.createScenario, "function");
  assert.equal(typeof controller.publishScenario, "function");
});
