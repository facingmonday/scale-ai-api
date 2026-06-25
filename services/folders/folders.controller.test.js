const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./folders.controller");

test("folders.controller exports handlers", () => {
  assert.equal(typeof controller.get, "function");
});
