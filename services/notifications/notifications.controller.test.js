const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./notifications.controller");

test("notifications.controller exports handlers", () => {
  assert.equal(typeof controller.get, "function");
});
