const test = require("node:test");
const assert = require("node:assert/strict");

const AutomationTask = require("./automationTask.model");
const AutomationTaskRun = require("./automationTaskRun.model");

test("automation task models export statics", () => {
  assert.equal(typeof AutomationTask.trigger, "function");
  assert.equal(typeof AutomationTaskRun.executeTaskRun, "function");
  assert.equal(typeof AutomationTaskRun.buildPromptContext, "function");
});
