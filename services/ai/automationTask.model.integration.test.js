const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const AutomationTask = require("./automationTask.model");
const AutomationTaskRun = require("./automationTaskRun.model");

test("automationTask trigger enqueues runs for active tasks", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await clearCollections();
  const orgId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const challengeId = new mongoose.Types.ObjectId();
  const clerkUserId = "automation_test_user";

  const task = await AutomationTask.create({
    name: "Test Automation",
    promptTemplate: "Summarize class performance",
    classroomId,
    trigger: "AFTER_CHALLENGE_CLOSED",
    actionType: "GENERATE_REPORT",
    isActive: true,
    organization: orgId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  const queue = require("../../lib/queues/automation-task-worker");
  const originalEnqueue = queue.enqueueAutomationTaskRun;
  queue.enqueueAutomationTaskRun = async () => {};

  try {
    const result = await AutomationTask.trigger("AFTER_CHALLENGE_CLOSED", {
      classroomId,
      challengeId,
      organizationId: orgId,
      clerkUserId,
    });

    assert.equal(result.success, true);
    assert.equal(result.count, 1);

    const runs = await AutomationTaskRun.find({ automationTaskId: task._id });
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, "pending");
  } finally {
    queue.enqueueAutomationTaskRun = originalEnqueue;
  }
});
