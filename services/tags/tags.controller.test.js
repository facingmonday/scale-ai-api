const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./tags.controller");

test("tags.controller exports handlers", () => {
  assert.equal(typeof controller.get, "function");
});
