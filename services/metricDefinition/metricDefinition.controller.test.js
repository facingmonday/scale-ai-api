const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./metricDefinition.controller");

test("metricDefinition.controller exports handlers", () => {
  assert.equal(typeof controller.getMetricDefinitions, "function");
});
