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

  return SimulationWorker.processJob(jobId, { isFinalAttempt });
};

/**
 * Initialize simulation worker (concurrency 1)
 */
const initSimulationWorker = () => {
  console.log("🧮 Initializing simulation worker...");

  queues.simulation.process(1, processSimulationJob);

  queues.simulation.on("completed", (job) => {
    console.log(`✅ Simulation job completed: ${job.data?.jobId || job.id}`);
  });

  queues.simulation.on("failed", (job, err) => {
    const id = job?.data?.jobId || job?.id || "unknown";
    console.error(`❌ Simulation job failed: ${id} - ${err.message}`);
  });

  queues.simulation.on("stalled", (job) => {
    const id = job?.data?.jobId || job?.id || "unknown";
    console.warn(`⚠️ Simulation job stalled: ${id}`);
  });

  queues.simulation.on("error", (err) => {
    console.error(`❌ Simulation queue error:`, err.message);
  });

  console.log("✅ Simulation worker initialized (concurrency: 1)");
};

/**
 * Enqueue a simulation job (adds Bull job for a SimulationJob document)
 */
const enqueueSimulationJob = async (jobId) => {
  if (!jobId) {
    throw new Error("jobId is required to enqueue simulation job");
  }

  await ensureQueueReady(queues.simulation, "simulation");

  return queues.simulation.add(
    { jobId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
};

module.exports = {
  initSimulationWorker,
  enqueueSimulationJob,
  processSimulationJob,
};
