const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./auth.controller");

test("auth controller exports handlers", () => {
  assert.equal(typeof controller.me, "function");
  assert.equal(typeof controller.setActiveClassroom, "function");
});
