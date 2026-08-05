const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./decision.controller");

test("decision controller exports handlers", () => {
  assert.equal(typeof controller.submitWeeklyDecisions, "function");
  assert.equal(typeof controller.getSubmissions, "function");
});
