const test = require("node:test");
const assert = require("node:assert/strict");

const controller = require("./job.controller");

test("job controller exports handlers", () => {
  assert.equal(typeof controller.getJobsByScenario, "function");
  assert.equal(typeof controller.getJobById, "function");
});
