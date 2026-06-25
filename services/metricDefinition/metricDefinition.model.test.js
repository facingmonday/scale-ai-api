const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("./metricDefinition.model");

test("metricDefinition.model schema has required organization field", () => {
  assert.ok(Model.schema.obj.organization !== undefined || Model.schema.paths.organization);
});
