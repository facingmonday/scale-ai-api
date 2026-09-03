const mongoose = require("mongoose");
const { queues, ensureQueueReady } = require("./index");
const SimulationWorker = require("../../services/job/lib/simulationWorker");

/**
 * Process a single simulation job from Bull
 */
const processSimulationJob = async (job) => {
  const { jobId } = job.data;
  if (!jobId) {
    throw new Error("Missing jobId in simulation job payload");
  }

  // Ensure DB connection (workers service may run standalone)
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URL || process.env.MONGO_URI);
  }

  const totalAttempts =
    (job &&
      job.opts &&
      typeof job.opts.attempts === "number" &&
      job.opts.attempts) ||
    1;
  const currentAttempt =
    (job && typeof job.attemptsMade === "number" ? job.attemptsMade : 0) + 1;
  const isFinalAttempt = currentAttempt >= totalAttempts;

  const SimulationJob = require("../../services/job/job.model");
  const document = await SimulationJob.findById(jobId);
  if (
    !document ||
    (job.data.processingRunId || null) !== (document.processingRunId || null)
  ) {
    return { skipped: true, reason: "Superseded calculation run" };
  }
  if (document.processingRunId && !document.dispatchReserved) {
    return { skipped: true, reason: "No dispatch reservation" };
  }
  // Bull may redeliver a stalled attempt after a worker process was restarted.
  if (document.status === "running") {
    document.status = "pending";
    await document.save();
  }
  return SimulationWorker.processJob(jobId, {
    isFinalAttempt,
    allowTerminalReconciliation: currentAttempt > 1,
  });
};

/**
 * Initialize simulation worker (env-configurable concurrency)
 */
const refill = (job) => {
  if (!job?.data?.challengeId) return;
  require("../../services/job/lib/challengeProcessing")
    .dispatchChallenge(job.data.challengeId)
    .catch((error) => {
      if (error.statusCode !== 409)
        console.error("Simulation refill failed:", error.message);
    });
};

const initSimulationWorker = () => {
  console.log("🧮 Initializing simulation worker...");

  const concurrency = 20; // Shared capacity; durable dispatch enforces each challenge limit.

  queues.simulation.process(concurrency, processSimulationJob);

  queues.simulation.on("completed", (job) => {
    console.log(`✅ Simulation job completed: ${job.data?.jobId || job.id}`);
    refill(job);
  });

  queues.simulation.on("failed", (job, err) => {
    const id = job?.data?.jobId || job?.id || "unknown";
    console.error(`❌ Simulation job failed: ${id} - ${err.message}`);
    const exhausted =
      Number(job?.attemptsMade || 0) >=
      Math.max(1, Number(job?.opts?.attempts || 1));
    if (exhausted) refill(job);
  });

  queues.simulation.on("stalled", (job) => {
    const id = job?.data?.jobId || job?.id || "unknown";
    console.warn(`⚠️ Simulation job stalled: ${id}`);
  });

  queues.simulation.on("error", (err) => {
    console.error(`❌ Simulation queue error:`, err.message);
  });

  const recover = () =>
    require("../../services/job/lib/challengeProcessing")
      .recoverDispatch()
      .catch((error) =>
        console.error("Simulation recovery failed:", error.message),
      );
  void recover();
  const recoveryTimer = setInterval(recover, 15000);
  recoveryTimer.unref();
  console.log(
    `✅ Simulation worker initialized (capacity: ${concurrency}, limits per challenge)`,
  );
};

/**
 * Enqueue a simulation job (adds Bull job for a SimulationJob document)
 */
const enqueueSimulationJob = async (jobId) => {
  if (!jobId) {
    throw new Error("jobId is required to enqueue simulation job");
  }

  const document = await require("../../services/job/job.model").findById(
    jobId,
  );
  if (!document) throw new Error("Job not found");
  return require("../../services/job/lib/challengeProcessing").enqueuePending(
    document.challengeId,
  );
};

module.exports = {
  initSimulationWorker,
  enqueueSimulationJob,
  processSimulationJob,
};
