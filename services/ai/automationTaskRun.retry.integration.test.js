const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const AutomationTask = require("./automationTask.model");
const AutomationTaskRun = require("./automationTaskRun.model");
const Notification = require("../notifications/notifications.model");
const Classroom = require("../classroom/classroom.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const LedgerEntry = require("../ledger/ledger.model");
const Member = require("../members/member.model");
const {
  AfterStudentLedgerCompleteBuilder,
} = require("./lib/promptContextBuilders");

before(async () => {
  await setupTestDb();
  await AutomationTaskRun.syncIndexes();
  await Notification.syncIndexes();
});

after(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

function ids() {
  return {
    organization: new mongoose.Types.ObjectId(),
    classroomId: new mongoose.Types.ObjectId(),
    challengeId: new mongoose.Types.ObjectId(),
    decisionId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
  };
}

test("automation execution throws for queue retry and can complete from failed state", async () => {
  const data = ids();
  const task = await AutomationTask.create({
    classroomId: data.classroomId,
    name: "Retryable task",
    trigger: "AFTER_CHALLENGE_CLOSED",
    promptTemplate: "Summarize results",
    actionType: "CUSTOM_PROMPT",
    organization: data.organization,
    createdBy: "admin",
    updatedBy: "admin",
  });
  const run = await AutomationTaskRun.create({
    automationTaskId: task._id,
    classroomId: data.classroomId,
    challengeId: data.challengeId,
    organization: data.organization,
    createdBy: "admin",
    updatedBy: "admin",
  });

  const originalBuildContext = AutomationTaskRun.buildPromptContext;
  const originalRunAgent = AutomationTaskRun.runAgent;
  let attempts = 0;
  AutomationTaskRun.buildPromptContext = async () => ({ scoped: true });
  AutomationTaskRun.runAgent = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary model failure");
    return { outputText: "Recovered" };
  };

  try {
    await assert.rejects(
      AutomationTaskRun.executeTaskRun(run._id),
      /temporary model failure/,
    );
    let persisted = await AutomationTaskRun.findById(run._id).lean();
    assert.equal(persisted.status, "failed");
    assert.equal(persisted.attempts, 1);

    const result = await AutomationTaskRun.executeTaskRun(run._id);
    assert.equal(result.success, true);
    persisted = await AutomationTaskRun.findById(run._id).lean();
    assert.equal(persisted.status, "completed");
    assert.equal(persisted.attempts, 2);
  } finally {
    AutomationTaskRun.buildPromptContext = originalBuildContext;
    AutomationTaskRun.runAgent = originalRunAgent;
  }
});

test("student ledger-complete email automation is scoped and idempotent", async () => {
  const data = ids();
  const task = await AutomationTask.create({
    classroomId: data.classroomId,
    name: "Email student summary",
    trigger: "AFTER_STUDENT_LEDGER_COMPLETE",
    promptTemplate: "Summarize this student's ledger results in plain language",
    actionType: "SEND_NOTIFICATION",
    organization: data.organization,
    createdBy: "admin",
    updatedBy: "admin",
  });

  const queue = require("../../lib/queues/automation-task-worker");
  const originalEnqueue = queue.enqueueAutomationTaskRun;
  queue.enqueueAutomationTaskRun = async () => ({ id: "test-job" });

  const triggerData = {
    classroomId: data.classroomId,
    challengeId: data.challengeId,
    decisionId: data.decisionId,
    userId: data.userId,
    organizationId: data.organization,
    clerkUserId: "admin",
  };
  const triggerOptions = {
    idempotencyPrefix: `ledger-completion-event:${data.decisionId}`,
    throwOnError: true,
  };

  try {
    const first = await AutomationTask.trigger(
      "AFTER_STUDENT_LEDGER_COMPLETE",
      triggerData,
      triggerOptions,
    );
    const repeated = await AutomationTask.trigger(
      "AFTER_STUDENT_LEDGER_COMPLETE",
      triggerData,
      triggerOptions,
    );
    assert.equal(first.count, 1);
    assert.equal(repeated.count, 1);
    assert.equal(String(first.runIds[0]), String(repeated.runIds[0]));
    assert.equal(await AutomationTaskRun.countDocuments(), 1);

    const originalBuildContext = AutomationTaskRun.buildPromptContext;
    const originalRunAgent = AutomationTaskRun.runAgent;
    const originalGetReceiver = Notification.getReceiver;
    const originalSendEmail = Notification.sendEmailNotification;
    let emailQueueCalls = 0;
    AutomationTaskRun.buildPromptContext = async () => ({
      student: { name: "Scoped Student" },
      studentResults: { metrics: { profit: 10 } },
    });
    AutomationTaskRun.runAgent = async () => ({
      outputText: "Your result summary",
    });
    Notification.getReceiver = async () => ({
      email: "",
      preferences: { email: true },
    });
    Notification.sendEmailNotification = async (notification) => {
      emailQueueCalls += 1;
      await Notification.updateOne(
        { _id: notification._id },
        { $set: { "metadata.emailQueued": true } },
      );
      return true;
    };

    try {
      await AutomationTaskRun.executeTaskRun(first.runIds[0]);
      const notification = await Notification.findOne().lean();
      assert.ok(notification);
      assert.equal(String(notification.recipient.id), String(data.userId));
      assert.equal(notification.message, "Your result summary");
      assert.equal(await Notification.countDocuments(), 1);

      const repeatedExecution = await AutomationTaskRun.executeTaskRun(
        first.runIds[0],
      );
      assert.equal(repeatedExecution.skipped, true);
      assert.equal(await Notification.countDocuments(), 1);
      assert.equal(emailQueueCalls, 1);
    } finally {
      AutomationTaskRun.buildPromptContext = originalBuildContext;
      AutomationTaskRun.runAgent = originalRunAgent;
      Notification.getReceiver = originalGetReceiver;
      Notification.sendEmailNotification = originalSendEmail;
    }
  } finally {
    queue.enqueueAutomationTaskRun = originalEnqueue;
  }
});

test("student ledger-complete context contains only the addressed student's data", async () => {
  const data = ids();
  const otherUserId = new mongoose.Types.ObjectId();
  await Classroom.create({
    _id: data.classroomId,
    name: "Privacy test classroom",
    ownership: new mongoose.Types.ObjectId(),
    organization: data.organization,
    createdBy: "admin",
    updatedBy: "admin",
  });
  await Challenge.create({
    _id: data.challengeId,
    classroomId: data.classroomId,
    title: "Privacy test challenge",
    feedbackReleaseMode: "MANUAL",
    organization: data.organization,
    createdBy: "admin",
    updatedBy: "admin",
  });
  await Member.create({
    _id: data.userId,
    clerkUserId: "student-1",
    firstName: "Scoped",
    lastName: "Student",
    createdAt: new Date(),
    organizationMemberships: [],
    organization: data.organization,
    createdBy: "student-1",
    updatedBy: "student-1",
  });
  const decision = await Decision.create({
    _id: data.decisionId,
    classroomId: data.classroomId,
    challengeId: data.challengeId,
    userId: data.userId,
    organization: data.organization,
    createdBy: "student-1",
    updatedBy: "student-1",
  });
  await Decision.create({
    classroomId: data.classroomId,
    challengeId: data.challengeId,
    userId: otherUserId,
    organization: data.organization,
    createdBy: "student-2",
    updatedBy: "student-2",
  });
  await LedgerEntry.create({
    classroomId: data.classroomId,
    challengeId: data.challengeId,
    decisionId: decision._id,
    userId: data.userId,
    metrics: { profit: 25 },
    summary: "Scoped result",
    aiMetadata: {
      model: "test-model",
      runId: "privacy-test-run",
      generatedAt: new Date(),
    },
    organization: data.organization,
    createdBy: "admin",
    updatedBy: "admin",
  });

  const builder = new AfterStudentLedgerCompleteBuilder(
    {
      classroomId: data.classroomId,
      challengeId: data.challengeId,
      decisionId: data.decisionId,
      userId: data.userId,
    },
    "AFTER_STUDENT_LEDGER_COMPLETE",
  );
  const context = await builder.build();

  assert.equal(context.student.name, "Scoped Student");
  assert.equal(context.studentResults.summary, "Scoped result");
  assert.equal(context.studentResults.metrics.profit, 25);
  assert.equal("studentOutcomes" in context, false);
  assert.equal("classroomAverages" in context, false);
  assert.equal(JSON.stringify(context).includes(String(otherUserId)), false);
});
