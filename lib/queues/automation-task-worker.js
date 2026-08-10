const mongoose = require("mongoose");
const { queues, ensureQueueReady } = require("./index");
const AutomationTaskRun = require("../../services/ai/automationTaskRun.model");

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGO_URL || process.env.MONGO_URI);
}

const processAutomationTaskJob = async (job) => {
  const { runId } = job.data || {};
  if (!runId) {
    throw new Error("Missing runId in automation task job payload");
  }

  await ensureDbConnected();
  return AutomationTaskRun.executeTaskRun(runId, {
    allowRunningRetry: (job.attemptsMade || 0) > 0,
  });
};

const processLedgerCompletionEventJob = async (job) => {
  const { eventId } = job.data || {};
  if (!eventId) {
    throw new Error("Missing eventId in ledger completion event payload");
  }

  await ensureDbConnected();
  const LedgerCompletionEvent = require("../../services/job/ledgerCompletionEvent.model");
  return LedgerCompletionEvent.dispatchEvent(eventId, {
    allowProcessingRetry: (job.attemptsMade || 0) > 0,
  });
};

const initAutomationTaskWorker = () => {
  console.log("🤖 Initializing automation task worker...");

  const concurrency = 2;

  queues.automationTask.process(
    "run-task",
    concurrency,
    processAutomationTaskJob
  );
  queues.automationTask.process(
    "dispatch-ledger-completion",
    concurrency,
    processLedgerCompletionEventJob,
  );

  queues.automationTask.on("completed", (job) => {
    console.log(
      `✅ Automation task completed: id=${job.data?.runId || job.data?.eventId || job.id}`,
    );
  });

  queues.automationTask.on("failed", (job, err) => {
    const id = job?.data?.runId || job?.data?.eventId || job?.id || "unknown";
    console.error(`❌ Automation task failed: runId=${id} - ${err.message}`);
  });

  const recover = async () => {
    try {
      const LedgerCompletionEvent = require("../../services/job/ledgerCompletionEvent.model");
      const result = await LedgerCompletionEvent.recoverUndeliveredEvents();
      if (result.recovered > 0) {
        console.log(`♻️ Re-enqueued ${result.recovered} ledger completion event(s)`);
      }
    } catch (error) {
      console.error("❌ Ledger completion event recovery failed:", error.message);
    }
  };
  void recover();
  const recoveryTimer = setInterval(recover, 60 * 1000);
  recoveryTimer.unref?.();
};

const enqueueAutomationTaskRun = async (runId) => {
  await ensureQueueReady(queues.automationTask, "automationTask");

  const jobId = `automation-run:${String(runId)}`;
  const existingJob = await queues.automationTask.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === "failed") await existingJob.retry();
    return existingJob;
  }

  return queues.automationTask.add(
    "run-task",
    { runId },
    {
      jobId,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    }
  );
};

const enqueueLedgerCompletionEvent = async (eventId) => {
  await ensureQueueReady(queues.automationTask, "automationTask");

  const jobId = `ledger-completion-event:${String(eventId)}`;
  const existingJob = await queues.automationTask.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === "failed") await existingJob.retry();
    return existingJob;
  }

  return queues.automationTask.add(
    "dispatch-ledger-completion",
    { eventId },
    {
      jobId,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 },
    },
  );
};

module.exports = {
  initAutomationTaskWorker,
  enqueueAutomationTaskRun,
  enqueueLedgerCompletionEvent,
  processAutomationTaskJob,
  processLedgerCompletionEventJob,
};
