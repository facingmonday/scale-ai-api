const test = require("node:test");
const assert = require("node:assert/strict");
const serviceRunner = require("./ServiceRunner");

test("ServiceRunner exports runner instance", () => {
  assert.equal(typeof serviceRunner.runWorker, "function");
});
