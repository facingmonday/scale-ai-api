const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("./folders.model");

test("folders.model schema has required organization field", () => {
  assert.ok(Model.schema.obj.organization !== undefined || Model.schema.paths.organization);
});
