const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./members.controller");

test("members controller exports handlers", () => {
  assert.equal(typeof controller.getAllMembers, "function");
  assert.equal(typeof controller.getMemberById, "function");
});
