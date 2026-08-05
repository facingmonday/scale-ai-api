const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./classroomTemplate.controller");

test("classroomTemplate.controller exports handlers", () => {
  assert.equal(typeof controller.listTemplates, "function");
});
