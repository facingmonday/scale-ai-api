const test = require("node:test");
const assert = require("node:assert/strict");

const AutomationTaskRun = require("./automationTaskRun.model");

test("automationTaskRun exports agent helpers", () => {
  assert.equal(typeof AutomationTaskRun.runAgent, "function");
  assert.equal(typeof AutomationTaskRun.formatSlideOutlineForGamma, "function");
});
