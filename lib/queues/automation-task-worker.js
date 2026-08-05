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
  return AutomationTaskRun.executeTaskRun(runId);
};

const initAutomationTaskWorker = () => {
  console.log("🤖 Initializing automation task worker...");

  const concurrency = 2;

  queues.automationTask.process(
    "run-task",
    concurrency,
    processAutomationTaskJob
  );

  queues.automationTask.on("completed", (job) => {
    console.log(`✅ Automation task completed: runId=${job.data?.runId || job.id}`);
  });

  queues.automationTask.on("failed", (job, err) => {
    const id = job?.data?.runId || job?.id || "unknown";
    console.error(`❌ Automation task failed: runId=${id} - ${err.message}`);
  });
};

const enqueueAutomationTaskRun = async (runId) => {
  await ensureQueueReady(queues.automationTask, "automationTask");

  return queues.automationTask.add(
    "run-task",
    { runId },
    {
      jobId: `automation-run:${String(runId)}`,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    }
  );
};

module.exports = {
  initAutomationTaskWorker,
  enqueueAutomationTaskRun,
  processAutomationTaskJob,
};
