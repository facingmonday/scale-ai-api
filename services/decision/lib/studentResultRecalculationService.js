const crypto = require("node:crypto");
const Challenge = require("../../challenge/challenge.model");
const Decision = require("../decision.model");
const Outcome = require("../../outcome/outcome.model");
const LedgerEntry = require("../../ledger/ledger.model");
const SimulationJob = require("../../job/job.model");
const SimulationBatch = require("../../job/simulationBatch.model");
const simulationQueue = require("../../../lib/queues/simulation-worker");

const ACTIVE_JOB_STATUSES = ["pending", "running"];
const ACTIVE_BATCH_STATUSES = [
  "created",
  "submitted",
  "validating",
  "in_progress",
  "finalizing",
  "cancelling",
];
const COMPLETE_CHALLENGE_STATUSES = [
  "processed",
  "feedbackReleased",
  "COMPLETED",
];

class RecalculationConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "RecalculationConflictError";
    this.statusCode = 409;
  }
}

function isChallengeFullyProcessed(challenge) {
  return (
    challenge?.isClosed === true &&
    (COMPLETE_CHALLENGE_STATUSES.includes(challenge.automationStatus) ||
      !!challenge.automatedProcessedAt)
  );
}

async function findLaterLedger({ challenge, decision, organizationId }) {
  const orderConditions = [{ week: { $gt: challenge.week || 0 } }];
  if (challenge.createdDate) {
    orderConditions.push({
      week: challenge.week || 0,
      createdDate: { $gt: challenge.createdDate },
    });
  }

  const laterChallengeIds = await Challenge.find({
    organization: organizationId,
    classroomId: challenge.classroomId,
    _id: { $ne: challenge._id },
    $or: orderConditions,
  }).distinct("_id");

  if (laterChallengeIds.length === 0) return null;

  return LedgerEntry.findOne({
    organization: organizationId,
    classroomId: challenge.classroomId,
    userId: decision.userId,
    challengeId: { $in: laterChallengeIds },
  })
    .select("_id challengeId")
    .lean();
}

async function claimJob({
  decision,
  challenge,
  ledgerEntry,
  organizationId,
  clerkUserId,
  recalculationRunId,
}) {
  const reset = {
    classroomId: challenge.classroomId,
    decisionId: decision._id,
    status: "pending",
    attempts: 0,
    error: null,
    startedAt: null,
    completedAt: null,
    dryRun: false,
    ledgerWriteMode: "upsert",
    recalculationRunId,
    openaiRequest: null,
    openaiRequestRawMessages: null,
    openaiRequestPreparedAt: null,
    calculationContextSnapshot: null,
    batch: {
      openaiBatchId: null,
      inputFileId: null,
      outputFileId: null,
      errorFileId: null,
      submittedAt: null,
      completedAt: null,
    },
    ledgerEntryId: ledgerEntry._id,
    ledgerCompletionTracking: false,
    ledgerCompletionReconciledAt: null,
    updatedBy: clerkUserId,
  };

  const existing = await SimulationJob.findOne({
    organization: organizationId,
    challengeId: challenge._id,
    userId: decision.userId,
  })
    .select("_id status")
    .lean();

  if (existing && ACTIVE_JOB_STATUSES.includes(existing.status)) {
    throw new RecalculationConflictError(
      "This student result is already being calculated."
    );
  }

  if (existing) {
    const claimed = await SimulationJob.findOneAndUpdate(
      {
        _id: existing._id,
        organization: organizationId,
        status: { $nin: ACTIVE_JOB_STATUSES },
      },
      { $set: reset },
      { new: true, runValidators: true }
    );
    if (!claimed) {
      throw new RecalculationConflictError(
        "This student result is already being calculated."
      );
    }
    return claimed;
  }

  try {
    return await SimulationJob.create({
      ...reset,
      challengeId: challenge._id,
      userId: decision.userId,
      organization: organizationId,
      createdBy: clerkUserId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new RecalculationConflictError(
        "This student result is already being calculated."
      );
    }
    throw error;
  }
}

async function recalculateStudentResult({
  decision,
  organizationId,
  clerkUserId,
}) {
  const challenge = await Challenge.findOne({
    _id: decision.challengeId,
    organization: organizationId,
  }).select(
    "classroomId week isClosed automationStatus automatedProcessedAt createdDate"
  );
  if (!challenge) {
    const error = new Error("Challenge not found");
    error.statusCode = 404;
    throw error;
  }

  if (!isChallengeFullyProcessed(challenge)) {
    throw new RecalculationConflictError(
      "The challenge must be closed and fully processed before recalculating one student."
    );
  }
  if (decision.processingStatus !== "completed") {
    throw new RecalculationConflictError(
      "The student decision must have a completed result before it can be recalculated."
    );
  }

  const [outcome, ledgerEntry, activeBatch, activeJob] = await Promise.all([
    Outcome.findOne({
      challengeId: challenge._id,
      organization: organizationId,
    })
      .select("_id")
      .lean(),
    LedgerEntry.findOne({
      organization: organizationId,
      classroomId: challenge.classroomId,
      challengeId: challenge._id,
      userId: decision.userId,
    })
      .select("_id")
      .lean(),
    SimulationBatch.findOne({
      organization: organizationId,
      challengeId: challenge._id,
      status: { $in: ACTIVE_BATCH_STATUSES },
    })
      .select("_id status")
      .lean(),
    SimulationJob.findOne({
      organization: organizationId,
      challengeId: challenge._id,
      userId: decision.userId,
      status: { $in: ACTIVE_JOB_STATUSES },
    })
      .select("_id status")
      .lean(),
  ]);

  if (!outcome) {
    throw new RecalculationConflictError(
      "This challenge does not have an outcome to recalculate."
    );
  }
  if (!ledgerEntry) {
    throw new RecalculationConflictError(
      "This student does not have an existing ledger result to replace."
    );
  }
  if (activeBatch) {
    throw new RecalculationConflictError(
      "A challenge-level batch is still active. Wait for it to finish before recalculating one student."
    );
  }
  if (activeJob) {
    throw new RecalculationConflictError(
      "This student result is already being calculated."
    );
  }

  const laterLedger = await findLaterLedger({
    challenge,
    decision,
    organizationId,
  });
  if (laterLedger) {
    throw new RecalculationConflictError(
      "This student already has a later challenge result. Recalculate earlier results before later ones."
    );
  }

  const recalculationRunId = crypto.randomUUID();
  const job = await claimJob({
    decision,
    challenge,
    ledgerEntry,
    organizationId,
    clerkUserId,
    recalculationRunId,
  });

  await Decision.updateOne(
    { _id: decision._id, organization: organizationId },
    {
      $addToSet: { jobs: job._id },
      $set: { ledgerEntryId: ledgerEntry._id, updatedBy: clerkUserId },
    }
  );

  try {
    await simulationQueue.enqueueSimulationJob(job._id, {
      recalculationRunId,
    });
  } catch (error) {
    await SimulationJob.updateOne(
      { _id: job._id, recalculationRunId },
      {
        $set: {
          status: "failed",
          error: `Unable to queue recalculation: ${error.message}`,
          completedAt: new Date(),
        },
      }
    );
    error.statusCode = 503;
    throw error;
  }

  return {
    decisionId: decision._id,
    jobId: job._id,
    ledgerEntryId: ledgerEntry._id,
    recalculationRunId,
    status: "pending",
  };
}

module.exports = {
  ACTIVE_BATCH_STATUSES,
  RecalculationConflictError,
  isChallengeFullyProcessed,
  recalculateStudentResult,
};
