const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const EVENT_TYPES = Object.freeze({
  STUDENT_LEDGER_COMPLETE: "STUDENT_LEDGER_COMPLETE",
  CHALLENGE_LEDGERS_COMPLETE: "CHALLENGE_LEDGERS_COMPLETE",
});

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
  const Challenge = require("../challenge/challenge.model");
  const Decision = require("../decision/decision.model");
  const SimulationJob = require("./job.model");
  const LedgerEntry = require("../ledger/ledger.model");

  const challenge = await Challenge.findById(challengeId)
    .select("organization")
    .lean();
  if (!challenge) throw new Error(`Challenge not found: ${challengeId}`);
  const scopedQuery = {
    challengeId,
    organization: challenge.organization,
  };

  const [decisions, jobs, ledgers] = await Promise.all([
    Decision.find(scopedQuery).select("_id userId").lean(),
    SimulationJob.find(scopedQuery)
      .select("_id decisionId userId status dryRun")
      .lean(),
    LedgerEntry.find(scopedQuery).select("_id decisionId userId").lean(),
  ]);

  const failedJobCount = jobs.filter((job) => job.status === "failed").length;
  const completedJobCount = jobs.filter(
    (job) => job.status === "completed",
  ).length;
  const baseResult = {
    expectedDecisionCount: decisions.length,
    completedJobCount,
    failedJobCount,
    ledgerCount: ledgers.length,
  };

  if (jobs.some((job) => job.dryRun)) {
    return { ready: false, reason: "dry-run-job", ...baseResult };
  }
  if (failedJobCount > 0) {
    return { ready: false, reason: "analysis-failed", ...baseResult };
  }
  if (jobs.some((job) => job.status !== "completed")) {
    return { ready: false, reason: "analysis-not-terminal", ...baseResult };
  }
  if (jobs.length !== decisions.length) {
    return {
      ready: false,
      reason: jobs.length < decisions.length ? "missing-job" : "job-count-mismatch",
      ...baseResult,
    };
  }
  if (ledgers.length !== decisions.length) {
    return {
      ready: false,
      reason:
        ledgers.length < decisions.length
          ? "ledger-not-written"
          : "ledger-count-mismatch",
      ...baseResult,
    };
  }

  if (decisions.length === 0) {
    return {
      ready: true,
      reason: "no-submissions",
      ...baseResult,
    };
  }

  for (const decision of decisions) {
    const matchingJobs = jobs.filter((job) =>
      job.decisionId
        ? asString(job.decisionId) === asString(decision._id)
        : asString(job.userId) === asString(decision.userId),
    );
    if (matchingJobs.length !== 1) {
      return {
        ready: false,
        reason: "decision-job-mismatch",
        decisionId: decision._id,
        matchCount: matchingJobs.length,
        ...baseResult,
      };
    }

    const matchingLedgers = ledgers.filter((ledger) =>
      ledger.decisionId
        ? asString(ledger.decisionId) === asString(decision._id)
        : asString(ledger.userId) === asString(decision.userId),
    );
    if (matchingLedgers.length !== 1) {
      return {
        ready: false,
        reason: "decision-ledger-mismatch",
        decisionId: decision._id,
        matchCount: matchingLedgers.length,
        ...baseResult,
      };
    }
  }

  return {
    ready: true,
    reason: "all-ledgers-written",
    ...baseResult,
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

  const challenge = await Challenge.findById(challengeId);
  if (!challenge) throw new Error(`Challenge not found: ${challengeId}`);

  await challenge.completeResultCalculation(
    challenge.updatedBy || challenge.createdBy || "system",
  );

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
    let debrief = null;
    if (event.eventType === EVENT_TYPES.CHALLENGE_LEDGERS_COMPLETE) {
      const challengeDebriefService = require("../challenge/lib/challengeDebriefService");
      debrief = await challengeDebriefService.generateChallengeDebrief({
        challengeId: event.challengeId,
        organizationId: event.organization,
      });
    }

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
    return {
      success: true,
      eventId: event._id,
      automation: result,
      debrief: debrief
        ? { skipped: debrief.skipped, status: debrief.teacherDebrief?.status }
        : null,
    };
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
