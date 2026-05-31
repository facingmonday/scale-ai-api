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

async function processDueDeadlines(now) {
  const dueScenarios = await Challenge.find({
    automationMode: "FULL",
    isPublished: true,
    isClosed: false,
    submissionDeadlineAt: { $ne: null, $lte: now },
    automationStatus: { $ne: "PROCESSING" },
  }).sort({ submissionDeadlineAt: 1, week: 1 });

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

      if (!outcome.autoGenerateSubmissionsOnOutcome) {
        outcome.autoGenerateSubmissionsOnOutcome =
          challenge.missingSubmissionPolicy === "FORWARD_PREVIOUS"
            ? "FORWARD_PREVIOUS"
            : "SKIP";
      }
      if (!outcome.punishAbsentStudents) {
        outcome.punishAbsentStudents = challenge.punishAbsentStudents || "none";
      }
      outcome.updatedBy = SYSTEM_USER;
      await outcome.save();

      challenge.automationStatus = "PROCESSING";
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

async function runScenarioLifecycleCheck(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const published = await publishDueScenarios(now);
  const processed = await processDueDeadlines(now);

  return {
    now,
    published,
    processed,
    publishedCount: published.filter((result) => result.status === "published")
      .length,
    queuedCount: processed.filter((result) => result.status === "queued")
      .length,
    blockedCount: [...published, ...processed].filter(
      (result) => result.status === "blocked"
    ).length,
    failedCount: [...published, ...processed].filter(
      (result) => result.status === "failed"
    ).length,
  };
}

module.exports = {
  runScenarioLifecycleCheck,
};
