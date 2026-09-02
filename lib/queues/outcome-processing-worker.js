const mongoose = require("mongoose");
const { queues, ensureQueueReady } = require("./index");

const Challenge = require("../../services/challenge/challenge.model");
const Outcome = require("../../services/outcome/outcome.model");
const JobService = require("../../services/job/lib/jobService");
const SimulationBatch = require("../../services/job/simulationBatch.model");

const Decision = require("../../services/decision/decision.model");
const classroomReadinessService = require("../../services/classroom/classroomReadiness.service");

const {
  enqueueSimulationBatchSubmit,
} = require("./simulation-batch-worker");

async function wasCalculationCancelled(challengeId, queuedAt) {
  return !!(await Challenge.exists({
    _id: challengeId,
    calculationCancelledAt: { $gte: queuedAt },
  }));
}

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGO_URL || process.env.MONGO_URI);
}

/**
 * Outcome processing worker:
 * - Handle missing decisions using the policy stored on the challenge
 * - Create SimulationJobs for all decisions with controlled concurrency
 * - If batch mode, enqueue a single challenge-level batch submit job
 * - Close submissions and leave the challenge calculating until all jobs end
 */
const processOutcomeProcessingJob = async (job) => {
  const { challengeId, organizationId, clerkUserId } = job.data || {};
  const queuedAt = new Date(job.timestamp || Date.now());
  if (!challengeId || !organizationId || !clerkUserId) {
    throw new Error(
      "Missing required fields in outcome processing payload (challengeId, organizationId, clerkUserId)"
    );
  }

  await ensureDbConnected();

  const challenge = await Challenge.findOne({
    _id: challengeId,
    organization: organizationId,
  });
  if (!challenge) {
    throw new Error("Challenge not found");
  }
  if (await wasCalculationCancelled(challengeId, queuedAt)) {
    return { success: true, cancelled: true, challengeId };
  }
  if (challenge.isClosed) {
    const LedgerCompletionEvent = require("../../services/job/ledgerCompletionEvent.model");
    const completion =
      await LedgerCompletionEvent.recordChallengeLedgersComplete(challengeId);
    return {
      success: true,
      skipped: true,
      reason: "Challenge already closed",
      ledgerCompletionReady: completion.ready,
      ledgerCompletionEventId: completion.event?._id,
    };
  }

  if (challenge.automationMode === "FULL") {
    challenge.automationStatus = "processing";
    challenge.automationError = null;
    challenge.automationLastCheckedAt = new Date();
    await challenge.save();
  }

  const outcome = await Outcome.getOutcomeByScenario(challengeId);
  if (!outcome) {
    throw new Error("Challenge outcome not found");
  }

  // The scheduler settings on the challenge are the single source of truth.
  // Outcome notes describe what happened; they do not configure attendance policy.
  const { mode: autoGenerateMode, punishment: punishAbsentStudents } =
    getMissingSubmissionSettings(challenge);
  let autoGenerateResult = null;

  if (autoGenerateMode === "USE_DEFAULTS") {
    autoGenerateResult = await Decision.useDefaultsForDecisions({
      challengeId,
      organizationId,
      clerkUserId,
      punishAbsentStudents,
    });
  } else if (autoGenerateMode === "FORWARD_PREVIOUS") {
    autoGenerateResult = await Decision.forwardPreviousDecisionsForChallenge({
      challengeId,
      organizationId,
      clerkUserId,
      punishAbsentStudents,
    });
  } else if (autoGenerateMode === "SKIP") {
    autoGenerateResult = {
      skipped: true,
      reason: "Missing decisions were skipped by challenge policy",
    };
  }

  // Re-evaluate after the missing-submission policy has run so generated
  // decisions are subject to the same profile and ledger checks as manual ones.
  await classroomReadinessService.assertClassroomReady({
    classroomId: challenge.classroomId,
    organizationId,
    challengeId,
    operation: "process",
  });

  // Create jobs for all decisions (dryRun = false, will write to ledger)
  const simulationMode = String(process.env.SIMULATION_MODE || "direct");
  const useBatch = simulationMode === "batch";

  if (await wasCalculationCancelled(challengeId, queuedAt)) {
    return { success: true, cancelled: true, challengeId };
  }

  const jobs = await JobService.createJobsForScenario(
    challengeId,
    challenge.classroomId,
    false,
    organizationId,
    clerkUserId,
    {
      enqueue: !useBatch,
    }
  );

  if (await wasCalculationCancelled(challengeId, queuedAt)) {
    await JobService.cancelJobsForScenario(challengeId, organizationId);
    return { success: true, cancelled: true, challengeId };
  }

  // If using OpenAI Batch, submit a single challenge-level batch job.
  if (useBatch) {
    await enqueueSimulationBatchSubmit({
      challengeId,
      classroomId: challenge.classroomId,
      organizationId,
      clerkUserId,
    });
  }

  if (await wasCalculationCancelled(challengeId, queuedAt)) {
    await JobService.cancelJobsForScenario(challengeId, organizationId);
    if (useBatch) {
      await SimulationBatch.cancelInProgressBatchForScenario(challengeId);
    }
    return { success: true, cancelled: true, challengeId };
  }

  // Close submissions last (decision creation requires isClosed=false), but
  // do not mark the challenge completed until ledger reconciliation confirms
  // that every simulation job is terminal.
  await challenge.beginResultCalculation(clerkUserId);

  // Zero-submission challenges deliberately produce an aggregate completion
  // event. For non-empty challenges this remains not-ready until the terminal
  // simulation workers have durably written their applicable ledgers.
  const LedgerCompletionEvent = require("../../services/job/ledgerCompletionEvent.model");
  const completion =
    await LedgerCompletionEvent.recordChallengeLedgersComplete(challengeId);

  return {
    success: true,
    challengeId,
    jobsCreated: jobs.length,
    autoGeneratedSubmissions: autoGenerateResult
      ? {
          created: autoGenerateResult.created || 0,
          existing: autoGenerateResult.existing || 0,
          missingStore: autoGenerateResult.missingStore,
          missingPrevious: autoGenerateResult.missingPrevious,
          errors: autoGenerateResult.errors?.length || 0,
        }
      : null,
    batchEnqueued: useBatch,
    ledgerCompletionReady: completion.ready,
    ledgerCompletionEventId: completion.event?._id,
  };
};

const getMissingSubmissionSettings = (challenge) => {
  const supportedModes = new Set(["FORWARD_PREVIOUS", "USE_DEFAULTS", "SKIP"]);
  const supportedPunishments = new Set(["high", "medium", "low", "none"]);
  const mode = supportedModes.has(challenge?.missingSubmissionPolicy)
    ? challenge.missingSubmissionPolicy
    : "SKIP";
  const punishment = supportedPunishments.has(challenge?.punishAbsentStudents)
    ? challenge.punishAbsentStudents
    : "none";

  return { mode, punishment };
};

const markOutcomeProcessingFailed = async (
  job,
  error,
  ChallengeModel = Challenge
) => {
  const challengeId = job?.data?.challengeId;
  if (!challengeId) return false;

  const attemptsMade = Number(job?.attemptsMade || 0);
  const maxAttempts = Math.max(1, Number(job?.opts?.attempts || 1));
  if (attemptsMade < maxAttempts) return false;

  await ChallengeModel.updateOne(
    { _id: challengeId, isClosed: false },
    {
      $set: {
        automationStatus: "FAILED",
        automationError: error?.message || String(error || "Unknown error"),
        automationLastCheckedAt: new Date(),
      },
    }
  );

  return true;
};

const initOutcomeProcessingWorker = () => {
  console.log("🧰 Initializing outcome processing worker...");

  const parsedConcurrency = parseInt(
    process.env.OUTCOME_PROCESSING_CONCURRENCY || "1",
    10
  );
  const concurrency = Number.isFinite(parsedConcurrency)
    ? Math.max(1, parsedConcurrency)
    : 1;

  queues.outcomeProcessing.process(
    "process-outcome",
    concurrency,
    processOutcomeProcessingJob
  );

  queues.outcomeProcessing.on("completed", (job, result) => {
    console.log(
      `✅ Outcome processing completed: ${job.data?.challengeId || job.id}`,
      result && typeof result === "object" ? result : undefined
    );
  });

  queues.outcomeProcessing.on("failed", (job, err) => {
    const id = job?.data?.challengeId || job?.id || "unknown";
    console.error(`❌ Outcome processing failed: ${id} - ${err.message}`);
    void markOutcomeProcessingFailed(job, err).catch((updateError) => {
      console.error(
        `❌ Failed to record outcome processing failure for ${id}: ${updateError.message}`
      );
    });
  });

  console.log(
    `✅ Outcome processing worker initialized (concurrency: ${concurrency})`
  );
};

/**
 * Enqueue an outcome processing job.
 * Uses a deterministic jobId to avoid duplicate enqueues per challenge.
 */
const enqueueOutcomeProcessing = async ({
  challengeId,
  organizationId,
  clerkUserId,
}) => {
  await ensureQueueReady(queues.outcomeProcessing, "outcomeProcessing");

  return queues.outcomeProcessing.add(
    "process-outcome",
    { challengeId, organizationId, clerkUserId },
    {
      jobId: `challenge-outcome:${String(challengeId)}`,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    }
  );
};

module.exports = {
  initOutcomeProcessingWorker,
  enqueueOutcomeProcessing,
  processOutcomeProcessingJob,
  markOutcomeProcessingFailed,
  getMissingSubmissionSettings,
};
