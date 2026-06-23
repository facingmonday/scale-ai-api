const test = require("node:test");
const assert = require("node:assert/strict");

test("variableValue model schema exists", () => {
  assert.ok(require("./variableValue.model").schema);
});
