const test = require("node:test");
const assert = require("node:assert/strict");

test("variableDefinition model schema exists", () => {
  assert.ok(require("./variableDefinition.model").schema);
});
