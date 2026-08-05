const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./variableDefinition.controller");

test("variableDefinition controller exports handlers", () => {
  assert.equal(typeof controller.getVariableDefinitions, "function");
});
