const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const EVENT_TYPES = Object.freeze({
  STUDENT_LEDGER_COMPLETE: "STUDENT_LEDGER_COMPLETE",
  CHALLENGE_LEDGERS_COMPLETE: "CHALLENGE_LEDGERS_COMPLETE",
});

const TERMINAL_JOB_STATUSES = new Set(["completed", "failed"]);

const ledgerCompletionEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: Object.values(EVENT_TYPES),
    required: true,
    index: true,
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Challenge",
    required: true,
    index: true,
  },
  decisionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Decision",
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
    required: true,
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  expectedDecisionCount: { type: Number, default: 0, min: 0 },
  completedJobCount: { type: Number, default: 0, min: 0 },
  failedJobCount: { type: Number, default: 0, min: 0 },
  ledgerCount: { type: Number, default: 0, min: 0 },
  error: { type: String, default: null },
  lastAttemptAt: { type: Date, default: null },
  processedAt: { type: Date, default: null },
}).add(baseSchema);

ledgerCompletionEventSchema.index({ challengeId: 1, eventType: 1 });
ledgerCompletionEventSchema.index({ status: 1, updatedDate: 1 });

function asString(value) {
  return value == null ? "" : String(value);
}

async function enqueuePersistedEvent(event) {
  const {
    enqueueLedgerCompletionEvent,
  } = require("../../lib/queues/automation-task-worker");

  try {
    await enqueueLedgerCompletionEvent(event._id);
  } catch (error) {
    await event.constructor.updateOne(
      { _id: event._id, status: { $ne: "completed" } },
      { $set: { error: `Queue dispatch failed: ${error.message}` } },
    );
    throw error;
  }
}

ledgerCompletionEventSchema.statics.evaluateChallenge = async function (
  challengeId,
) {
  const Decision = require("../decision/decision.model");
  const SimulationJob = require("./job.model");
  const LedgerEntry = require("../ledger/ledger.model");

  const [decisions, jobs, ledgers] = await Promise.all([
    Decision.find({ challengeId }).select("_id userId ledgerEntryId").lean(),
    SimulationJob.find({ challengeId })
      .select("_id decisionId userId status dryRun")
      .lean(),
    LedgerEntry.find({ challengeId }).select("_id decisionId userId").lean(),
  ]);

  if (decisions.length === 0) {
    return {
      ready: true,
      reason: "no-submissions",
      expectedDecisionCount: 0,
      completedJobCount: 0,
      failedJobCount: 0,
      ledgerCount: 0,
    };
  }

  const jobsByDecision = new Map();
  const jobsByUser = new Map();
  for (const job of jobs) {
    if (job.decisionId) jobsByDecision.set(asString(job.decisionId), job);
    jobsByUser.set(asString(job.userId), job);
  }

  const ledgersByDecision = new Map();
  const ledgersByUser = new Map();
  for (const ledger of ledgers) {
    if (ledger.decisionId) {
      ledgersByDecision.set(asString(ledger.decisionId), ledger);
    }
    ledgersByUser.set(asString(ledger.userId), ledger);
  }

  let completedJobCount = 0;
  let failedJobCount = 0;
  let ledgerCount = 0;

  for (const decision of decisions) {
    const job =
      jobsByDecision.get(asString(decision._id)) ||
      jobsByUser.get(asString(decision.userId));

    if (!job) {
      return {
        ready: false,
        reason: "missing-job",
        decisionId: decision._id,
        expectedDecisionCount: decisions.length,
      };
    }

    if (!TERMINAL_JOB_STATUSES.has(job.status)) {
      return {
        ready: false,
        reason: "analysis-not-terminal",
        decisionId: decision._id,
        jobId: job._id,
        jobStatus: job.status,
        expectedDecisionCount: decisions.length,
      };
    }

    if (job.status === "failed") {
      failedJobCount += 1;
      continue;
    }

    const ledger =
      ledgersByDecision.get(asString(decision._id)) ||
      ledgersByUser.get(asString(decision.userId));
    if (!ledger || job.dryRun) {
      return {
        ready: false,
        reason: job.dryRun ? "dry-run-has-no-ledger" : "ledger-not-written",
        decisionId: decision._id,
        jobId: job._id,
        expectedDecisionCount: decisions.length,
      };
    }

    completedJobCount += 1;
    ledgerCount += 1;
  }

  return {
    ready: true,
    reason: "all-analysis-terminal",
    expectedDecisionCount: decisions.length,
    completedJobCount,
    failedJobCount,
    ledgerCount,
  };
};

ledgerCompletionEventSchema.statics.recordStudentLedgerComplete = async function (
  jobOrId,
  options = {},
) {
  const SimulationJob = require("./job.model");
  const Decision = require("../decision/decision.model");
  const LedgerEntry = require("../ledger/ledger.model");
  const Challenge = require("../challenge/challenge.model");

  const jobId = jobOrId?._id || jobOrId;
  const job = await SimulationJob.findById(jobId).lean();
  if (!job || job.status !== "completed" || job.dryRun) {
    return { ready: false, reason: "student-ledger-not-applicable" };
  }

  const decision = job.decisionId
    ? await Decision.findById(job.decisionId).select("_id userId").lean()
    : await Decision.findOne({
        classroomId: job.classroomId,
        challengeId: job.challengeId,
        userId: job.userId,
      })
        .select("_id userId")
        .lean();
  if (!decision) {
    return { ready: false, reason: "decision-not-found" };
  }

  const ledger = await LedgerEntry.findOne({
    challengeId: job.challengeId,
    userId: job.userId,
  })
    .select("_id")
    .lean();
  if (!ledger) {
    return { ready: false, reason: "ledger-not-written" };
  }

  const challenge = await Challenge.findById(job.challengeId)
    .select("classroomId organization updatedBy createdBy")
    .lean();
  if (!challenge) throw new Error(`Challenge not found: ${job.challengeId}`);

  const idempotencyKey = `student-ledger-complete:${job.challengeId}:${decision._id}`;
  const event = await this.findOneAndUpdate(
    { idempotencyKey },
    {
      $setOnInsert: {
        eventType: EVENT_TYPES.STUDENT_LEDGER_COMPLETE,
        idempotencyKey,
        classroomId: challenge.classroomId,
        challengeId: job.challengeId,
        decisionId: decision._id,
        userId: decision.userId,
        status: "pending",
        expectedDecisionCount: 1,
        completedJobCount: 1,
        failedJobCount: 0,
        ledgerCount: 1,
        organization: challenge.organization,
        createdBy: challenge.updatedBy || challenge.createdBy || "system",
        updatedBy: challenge.updatedBy || challenge.createdBy || "system",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (options.enqueue !== false && event.status !== "completed") {
    await enqueuePersistedEvent(event);
  }
  return { ready: true, event };
};

ledgerCompletionEventSchema.statics.recordChallengeLedgersComplete = async function (
  challengeId,
  options = {},
) {
  const Challenge = require("../challenge/challenge.model");
  const evaluation = await this.evaluateChallenge(challengeId);
  if (!evaluation.ready) return evaluation;

  const challenge = await Challenge.findById(challengeId)
    .select("classroomId organization updatedBy createdBy")
    .lean();
  if (!challenge) throw new Error(`Challenge not found: ${challengeId}`);

  const idempotencyKey = `challenge-ledgers-complete:${challengeId}`;
  const event = await this.findOneAndUpdate(
    { idempotencyKey },
    {
      $setOnInsert: {
        eventType: EVENT_TYPES.CHALLENGE_LEDGERS_COMPLETE,
        idempotencyKey,
        classroomId: challenge.classroomId,
        challengeId,
        status: "pending",
        expectedDecisionCount: evaluation.expectedDecisionCount,
        completedJobCount: evaluation.completedJobCount,
        failedJobCount: evaluation.failedJobCount,
        ledgerCount: evaluation.ledgerCount,
        organization: challenge.organization,
        createdBy: challenge.updatedBy || challenge.createdBy || "system",
        updatedBy: challenge.updatedBy || challenge.createdBy || "system",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (options.enqueue !== false && event.status !== "completed") {
    await enqueuePersistedEvent(event);
  }
  return { ...evaluation, event };
};

ledgerCompletionEventSchema.statics.recordReadyEventsForJob = async function (
  jobOrId,
  options = {},
) {
  const SimulationJob = require("./job.model");
  const jobId = jobOrId?._id || jobOrId;
  const job = await SimulationJob.findById(jobId).select("challengeId").lean();
  if (!job) throw new Error(`Simulation job not found: ${jobId}`);

  const student = await this.recordStudentLedgerComplete(jobId, options);
  const challenge = await this.recordChallengeLedgersComplete(
    job.challengeId,
    options,
  );
  await SimulationJob.updateOne(
    { _id: jobId },
    { $set: { ledgerCompletionReconciledAt: new Date() } },
  );
  return { student, challenge };
};

ledgerCompletionEventSchema.statics.dispatchEvent = async function (
  eventId,
  options = {},
) {
  const allowedStatuses = ["pending", "failed"];
  if (options.allowProcessingRetry) allowedStatuses.push("processing");

  const event = await this.findOneAndUpdate(
    { _id: eventId, status: { $in: allowedStatuses } },
    {
      $set: {
        status: "processing",
        error: null,
        lastAttemptAt: new Date(),
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  );

  if (!event) {
    const existing = await this.findById(eventId).lean();
    if (!existing) throw new Error(`Ledger completion event not found: ${eventId}`);
    return { success: true, skipped: true, status: existing.status };
  }

  try {
    const AutomationTask = require("../ai/automationTask.model");
    const triggerType =
      event.eventType === EVENT_TYPES.STUDENT_LEDGER_COMPLETE
        ? "AFTER_STUDENT_LEDGER_COMPLETE"
        : "AFTER_CHALLENGE_CLOSED";

    const result = await AutomationTask.trigger(
      triggerType,
      {
        classroomId: event.classroomId,
        challengeId: event.challengeId,
        decisionId: event.decisionId,
        userId: event.userId,
        organizationId: event.organization,
        clerkUserId: event.updatedBy || event.createdBy || "system",
      },
      {
        idempotencyPrefix: `ledger-completion-event:${event._id}`,
        throwOnError: true,
      },
    );

    event.status = "completed";
    event.processedAt = new Date();
    event.error = null;
    await event.save();
    return { success: true, eventId: event._id, automation: result };
  } catch (error) {
    event.status = "failed";
    event.error = error.message;
    await event.save();
    throw error;
  }
};

ledgerCompletionEventSchema.statics.recoverUndeliveredEvents = async function () {
  const SimulationJob = require("./job.model");
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  await this.updateMany(
    { status: "processing", lastAttemptAt: { $lte: staleBefore } },
    {
      $set: {
        status: "failed",
        error: "Recovered stale processing lease",
      },
    },
  );

  const unreconciledJobs = await SimulationJob.find({
    ledgerCompletionTracking: true,
    ledgerCompletionReconciledAt: null,
    status: { $in: ["completed", "failed"] },
  })
    .select("_id")
    .sort({ completedAt: 1 })
    .limit(500)
    .lean();

  const errors = [];
  for (const job of unreconciledJobs) {
    try {
      await this.recordReadyEventsForJob(job._id);
    } catch (error) {
      errors.push(`${job._id}: ${error.message}`);
    }
  }

  const events = await this.find({ status: { $in: ["pending", "failed"] } })
    .sort({ createdDate: 1 })
    .limit(500);

  for (const event of events) {
    try {
      await enqueuePersistedEvent(event);
    } catch (error) {
      errors.push(`${event._id}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Failed to recover ${errors.length} ledger completion event(s): ${errors.join("; ")}`);
  }
  return {
    recovered: events.length,
    reconciledJobs: unreconciledJobs.length,
  };
};

ledgerCompletionEventSchema.statics.EVENT_TYPES = EVENT_TYPES;

module.exports =
  mongoose.models.LedgerCompletionEvent ||
  mongoose.model("LedgerCompletionEvent", ledgerCompletionEventSchema);
