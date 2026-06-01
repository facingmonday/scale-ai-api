const Challenge = require("./challenge.model");
const Outcome = require("../outcome/outcome.model");
const { enqueueOutcomeProcessing } = require("../../lib/queues/outcome-processing-worker");

const SYSTEM_USER = "system";

async function markBlocked(challenge, message) {
  challenge.automationStatus = "BLOCKED";
  challenge.automationError = message;
  challenge.automationLastCheckedAt = new Date();
  await challenge.save();
}

async function publishDueScenarios(now) {
  const dueScenarios = await Challenge.find({
    automationMode: "FULL",
    isPublished: false,
    isClosed: false,
    publishAt: { $ne: null, $lte: now },
  }).sort({ publishAt: 1, week: 1 });

  const results = [];

  for (const challenge of dueScenarios) {
    try {
      const activeScenario = await Challenge.getActiveScenario(challenge.classroomId);
      if (
        activeScenario &&
        activeScenario._id.toString() !== challenge._id.toString()
      ) {
        await markBlocked(
          challenge,
          `Another challenge is already active: ${activeScenario.title}`
        );
        results.push({
          challengeId: challenge._id,
          action: "publish",
          status: "blocked",
        });
        continue;
      }

      await challenge.publish(SYSTEM_USER);
      results.push({
        challengeId: challenge._id,
        action: "publish",
        status: "published",
      });
    } catch (error) {
      challenge.automationStatus = "FAILED";
      challenge.automationError = error.message;
      challenge.automationLastCheckedAt = new Date();
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "publish",
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
}

async function closeDueSubmissions(now) {
  const dueLocks = await Challenge.find({
    automationMode: "FULL",
    isPublished: true,
    isClosed: false,
    isLockedForStudents: false,
    closeSubmissionsAt: { $ne: null, $lte: now },
  }).sort({ closeSubmissionsAt: 1, week: 1 });

  const results = [];

  for (const challenge of dueLocks) {
    try {
      challenge.isLockedForStudents = true;
      challenge.automationStatus = "submissionsClosed";
      challenge.automationLastCheckedAt = now;
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "lock",
        status: "locked",
      });
    } catch (error) {
      challenge.automationStatus = "FAILED";
      challenge.automationError = error.message;
      challenge.automationLastCheckedAt = new Date();
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "lock",
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
}

async function processDueOutcomes(now) {
  const dueScenarios = await Challenge.find({
    automationMode: "FULL",
    isPublished: true,
    isClosed: false,
    processAt: { $ne: null, $lte: now },
    automationStatus: { $nin: ["queuedForProcessing", "processing", "processed", "feedbackReleased", "FAILED"] },
  }).sort({ processAt: 1, week: 1 });

  const results = [];

  for (const challenge of dueScenarios) {
    try {
      const outcome = await Outcome.getOutcomeByScenario(challenge._id);
      if (!outcome) {
        await markBlocked(
          challenge,
          "A hidden outcome must be saved before automated processing can run"
        );
        results.push({
          challengeId: challenge._id,
          action: "process",
          status: "blocked",
        });
        continue;
      }

      // If the submissions lock time has passed but it wasn't locked yet, lock it now
      if (!challenge.isLockedForStudents) {
        challenge.isLockedForStudents = true;
      }

      if (!outcome.autoGenerateSubmissionsOnOutcome) {
        outcome.autoGenerateSubmissionsOnOutcome =
          challenge.missingSubmissionPolicy === "FORWARD_PREVIOUS"
            ? "FORWARD_PREVIOUS"
            : challenge.missingSubmissionPolicy === "USE_DEFAULTS"
            ? "USE_DEFAULTS"
            : "SKIP";
      }
      if (!outcome.punishAbsentStudents) {
        outcome.punishAbsentStudents = challenge.punishAbsentStudents || "none";
      }
      outcome.updatedBy = SYSTEM_USER;
      await outcome.save();

      challenge.automationStatus = "queuedForProcessing";
      challenge.automationError = null;
      challenge.automationLastCheckedAt = now;
      await challenge.save();

      const queuedJob = await enqueueOutcomeProcessing({
        challengeId: challenge._id,
        organizationId: challenge.organization,
        clerkUserId: SYSTEM_USER,
      });

      results.push({
        challengeId: challenge._id,
        action: "process",
        status: "queued",
        outcomeProcessingJobId: queuedJob?.id,
      });
    } catch (error) {
      challenge.automationStatus = "FAILED";
      challenge.automationError = error.message;
      challenge.automationLastCheckedAt = new Date();
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "process",
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
}

async function releaseDelayedFeedback(now) {
  const dueReleases = await Challenge.find({
    automationMode: "FULL",
    isPublished: true,
    isClosed: true,
    isFeedbackReleased: false,
    feedbackReleaseMode: "DELAYED",
    feedbackReleaseAt: { $ne: null, $lte: now },
  }).sort({ feedbackReleaseAt: 1, week: 1 });

  const results = [];

  for (const challenge of dueReleases) {
    try {
      challenge.isFeedbackReleased = true;
      challenge.automationStatus = "feedbackReleased";
      challenge.automationLastCheckedAt = now;
      await challenge.save();

      // Trigger student notifications in bulk since feedback is now released
      const LedgerEntry = require("../ledger/ledger.model");
      await LedgerEntry.sendResultsNotifications(challenge._id);

      results.push({
        challengeId: challenge._id,
        action: "release",
        status: "released",
      });
    } catch (error) {
      challenge.automationStatus = "FAILED";
      challenge.automationError = error.message;
      challenge.automationLastCheckedAt = new Date();
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "release",
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
}

async function runScenarioLifecycleCheck(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const published = await publishDueScenarios(now);
  const locked = await closeDueSubmissions(now);
  const processed = await processDueOutcomes(now);
  const released = await releaseDelayedFeedback(now);

  return {
    now,
    published,
    locked,
    processed,
    released,
    publishedCount: published.filter((result) => result.status === "published").length,
    lockedCount: locked.filter((result) => result.status === "locked").length,
    queuedCount: processed.filter((result) => result.status === "queued").length,
    releasedCount: released.filter((result) => result.status === "released").length,
    blockedCount: [...published, ...processed].filter((result) => result.status === "blocked").length,
    failedCount: [...published, ...locked, ...processed, ...released].filter((result) => result.status === "failed").length,
  };
}

module.exports = {
  runScenarioLifecycleCheck,
};
