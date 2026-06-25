const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./files.controller");

test("files.controller exports handlers", () => {
  assert.equal(typeof controller.uploadFile, "function");
});
