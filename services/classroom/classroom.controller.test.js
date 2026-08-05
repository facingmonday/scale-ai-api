const test = require("node:test");
const assert = require("node:assert/strict");

const controller = require("./classroom.controller");

test("classroom controller exports handlers", () => {
  assert.equal(typeof controller.createClass, "function");
  assert.equal(typeof controller.getAllClassrooms, "function");
  assert.equal(typeof controller.deleteClass, "function");
});
