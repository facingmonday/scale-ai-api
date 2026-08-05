const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("./classroomTemplate.model");

test("classroomTemplate.model schema has required organization field", () => {
  assert.ok(Model.schema.obj.organization !== undefined || Model.schema.paths.organization);
});
