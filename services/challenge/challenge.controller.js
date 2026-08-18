const Challenge = require("./challenge.model");
const Outcome = require("../outcome/outcome.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Decision = require("../decision/decision.model");
const JobService = require("../job/lib/jobService");
const LedgerEntry = require("../ledger/ledger.model");
const SimulationWorker = require("../job/lib/simulationWorker");
const SimulationBatch = require("../job/simulationBatch.model");
const challengeAiService = require("./lib/challengeAiService");
const {
  enqueueSimulationBatchSubmit,
} = require("../../lib/queues/simulation-batch-worker");


const SCHEDULE_FIELDS = [
  "publishAt",
  "submissionDeadlineAt",
  "closeSubmissionsAt",
  "processAt",
  "feedbackReleaseAt",
  "feedbackReleaseMode",
  "allowLateSubmissions",
  "lateSubmissionPolicy",
  "automationMode",
  "missingSubmissionPolicy",
  "punishAbsentStudents",
];

function parseOptionalDate(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function normalizeScheduleInput(body) {
  const schedule = {};

  if (body.publishAt !== undefined) {
    schedule.publishAt = parseOptionalDate(body.publishAt, "publishAt");
  }
  if (body.submissionDeadlineAt !== undefined) {
    schedule.submissionDeadlineAt = parseOptionalDate(
      body.submissionDeadlineAt,
      "submissionDeadlineAt"
    );
  }
  if (body.closeSubmissionsAt !== undefined) {
    schedule.closeSubmissionsAt = parseOptionalDate(
      body.closeSubmissionsAt,
      "closeSubmissionsAt"
    );
  }
  if (body.processAt !== undefined) {
    schedule.processAt = parseOptionalDate(body.processAt, "processAt");
  }
  if (body.feedbackReleaseAt !== undefined) {
    schedule.feedbackReleaseAt = parseOptionalDate(
      body.feedbackReleaseAt,
      "feedbackReleaseAt"
    );
  }
  if (body.feedbackReleaseMode !== undefined) {
    schedule.feedbackReleaseMode = body.feedbackReleaseMode || "IMMEDIATE";
  }
  if (body.allowLateSubmissions !== undefined) {
    schedule.allowLateSubmissions = !!body.allowLateSubmissions;
  }
  if (body.lateSubmissionPolicy !== undefined) {
    schedule.lateSubmissionPolicy = body.lateSubmissionPolicy;
  }
  if (body.automationMode !== undefined) {
    schedule.automationMode = body.automationMode || "FULL";
  }
  if (body.missingSubmissionPolicy !== undefined) {
    schedule.missingSubmissionPolicy = body.missingSubmissionPolicy || "SKIP";
  }
  if (body.punishAbsentStudents !== undefined) {
    schedule.punishAbsentStudents = body.punishAbsentStudents || "none";
  }

  const publishAt =
    schedule.publishAt !== undefined ? schedule.publishAt : body.publishAt;
  const submissionDeadlineAt =
    schedule.submissionDeadlineAt !== undefined
      ? schedule.submissionDeadlineAt
      : body.submissionDeadlineAt;

  if (
    publishAt &&
    submissionDeadlineAt &&
    new Date(submissionDeadlineAt).getTime() < new Date(publishAt).getTime()
  ) {
    const error = new Error("submissionDeadlineAt must be at or after publishAt");
    error.statusCode = 400;
    throw error;
  }

  return schedule;
}

function nextAutomationStatus(challenge, scheduleUpdates = {}) {
  const automationMode =
    scheduleUpdates.automationMode !== undefined
      ? scheduleUpdates.automationMode
      : challenge.automationMode;
  if (automationMode !== "FULL") return "UNSCHEDULED";
  if (challenge.isClosed) {
    return challenge.feedbackReleaseMode === "IMMEDIATE" ? "feedbackReleased" : "processed";
  }
  if (challenge.isPublished) {
    return challenge.isLockedForStudents ? "submissionsClosed" : "acceptingSubmissions";
  }

  const publishAt =
    scheduleUpdates.publishAt !== undefined
      ? scheduleUpdates.publishAt
      : challenge.publishAt;
  const deadlineAt =
    scheduleUpdates.submissionDeadlineAt !== undefined
      ? scheduleUpdates.submissionDeadlineAt
      : challenge.submissionDeadlineAt;
  return publishAt || deadlineAt ? "SCHEDULED" : "UNSCHEDULED";
}

/**
 * Get all challenges
 * GET /api/admin/challenges
 */
exports.getScenarios = async function (req, res) {
  try {
    const classroomId = req.query.classroomId;
    const challenges = await Challenge.find({ classroomId, week: { $ne: 0 } });
    res.status(200).json({
      success: true,
      data: challenges,
    });
  } catch (error) {
    console.error("Error getting challenges:", error);
    res.status(500).json({ error: error.message });
  }
};

/** Get challenge by id */
exports.getScenarioById = async function (req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.organization?._id;

    // Use static method which handles variable loading
    const challenge = await Challenge.getScenarioById(id, organizationId);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // If a challenge is closed, we need to return stats for the challenge
    if (challenge.isClosed) {
      // This includes stats for the challenge
      const stats = await Challenge.getStatsForScenario(challenge._id);
      challenge.stats = stats;
    }

    res.status(200).json({ success: true, data: challenge });
  } catch (error) {
    console.error("Error getting challenge by id:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create challenge
 * POST /api/admin/challenge
 */
exports.createScenario = async function (req, res) {
  try {
    const { classroomId, title, description, variables, imageUrl } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const scheduleInput = normalizeScheduleInput(req.body);

    // Validate required fields
    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const createAutomationMode = scheduleInput.automationMode || "FULL";

    // Create challenge using static method
    const challenge = await Challenge.createScenario(
      classroomId,
      {
        title,
        description,
        variables,
        imageUrl,
        ...scheduleInput,
        automationMode: createAutomationMode,
        automationStatus:
          createAutomationMode === "FULL"
            ? scheduleInput.publishAt || scheduleInput.submissionDeadlineAt
              ? "SCHEDULED"
              : "UNSCHEDULED"
            : "UNSCHEDULED",
      },
      organizationId,
      clerkUserId
    );

    // Trigger challenge created tasks asynchronously (do not block the response)
    const AutomationTask = require("../ai/automationTask.model");
    AutomationTask.trigger("AFTER_CHALLENGE_CREATED", {
      classroomId: challenge.classroomId,
      challengeId: challenge._id,
      organizationId,
      clerkUserId,
    }).catch((err) => {
      console.error("Error triggering AFTER_CHALLENGE_CREATED tasks:", err);
    });

    res.status(201).json({
      success: true,
      message: "Challenge created successfully",
      data: challenge,
    });
  } catch (error) {
    console.error("Error creating challenge:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.message.includes("Invalid challenge variables")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create a complete challenge from instructor source text.
 * POST /v1/admin/challenges/ai
 */
exports.createScenarioWithAI = async function (req, res) {
  try {
    const { classroomId, prompt, timeZone } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId,
    );

    const challenge = await challengeAiService.createChallengeFromPrompt({
      classroomId,
      prompt,
      timeZone,
      organizationId,
      clerkUserId,
    });

    const AutomationTask = require("../ai/automationTask.model");
    AutomationTask.trigger("AFTER_CHALLENGE_CREATED", {
      classroomId: challenge.classroomId,
      challengeId: challenge._id,
      organizationId,
      clerkUserId,
    }).catch((err) => {
      console.error("Error triggering AFTER_CHALLENGE_CREATED tasks:", err);
    });

    res.status(201).json({
      success: true,
      message: "Challenge created with AI successfully",
      data: challenge,
    });
  } catch (error) {
    console.error("Error creating challenge with AI:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({
      error: "Unable to create the generated challenge. Please try again.",
    });
  }
};

/**
 * Update challenge
 * PUT /api/admin/challenges/:challengeId
 */
exports.updateScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge (get Mongoose document, not plain object)
    const query = { _id: challengeId };
    if (organizationId) {
      query.organization = organizationId;
    }
    const challenge = await Challenge.findOne(query);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    // Check if can be edited
    if (!challenge.canEdit()) {
      return res.status(400).json({
        error:
          "Challenge cannot be edited after it has been published and closed",
      });
    }

    const scheduleInput = normalizeScheduleInput({
      ...req.body,
      publishAt:
        req.body.publishAt !== undefined ? req.body.publishAt : challenge.publishAt,
      submissionDeadlineAt:
        req.body.submissionDeadlineAt !== undefined
          ? req.body.submissionDeadlineAt
          : challenge.submissionDeadlineAt,
    });

    // Update allowed fields (excluding variables)
    const allowedFields = ["title", "description", "imageUrl"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        challenge[field] = req.body[field] || null;
      }
    });

    Object.entries(scheduleInput).forEach(([field, value]) => {
      if (req.body[field] !== undefined) {
        challenge[field] = value;
      }
    });

    if (SCHEDULE_FIELDS.some((field) => req.body[field] !== undefined)) {
      challenge.automationStatus = nextAutomationStatus(challenge, scheduleInput);
      challenge.automationError = null;
    }

    // Update variables if provided
    if (req.body.variables !== undefined) {
      await challenge.updateVariables(
        req.body.variables,
        organizationId,
        clerkUserId
      );
    }

    challenge.updatedBy = clerkUserId;
    await challenge.save();

    // Reload variables to ensure they're in the cache
    await challenge._loadVariables();

    // Convert to object with variables included
    const updatedScenario = challenge.toObject();

    res.json({
      success: true,
      message: "Challenge updated successfully",
      data: updatedScenario,
    });
  } catch (error) {
    console.error("Error updating challenge:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Publish challenge
 * POST /api/admin/challenges/:challengeId/publish
 */
exports.publishScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge as Mongoose document (needed for instance methods)
    const challenge = await Challenge.findOne({
      _id: challengeId,
      organization: organizationId,
    });

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    // Pre-publish validation: Check if challenge can be published
    if (challenge.isPublished) {
      return res.status(400).json({
        error: "Challenge is already published",
      });
    }

    if (challenge.isClosed) {
      return res.status(400).json({
        error: "Cannot publish a closed challenge",
      });
    }

    // Pre-publish validation: Check if another challenge is already active
    const activeScenario = await Challenge.getActiveScenario(
      challenge.classroomId
    );
    if (
      activeScenario &&
      activeScenario._id.toString() !== challenge._id.toString()
    ) {
      return res.status(400).json({
        error: `Another challenge is already active ("${activeScenario.title}"). Please unpublish or close the active challenge before publishing a new one.`,
        activeScenarioId: activeScenario._id,
        activeScenarioTitle: activeScenario.title,
      });
    }

    // Publish challenge
    await challenge.publish(clerkUserId);

    // Auto-generate decisions for all enrolled students (optional)
    let autoSubmissionResult = null;
    const autoEnabled = String(
      process.env.AUTO_GENERATE_SUBMISSIONS_ON_PUBLISH ?? "false"
    ).toLowerCase();
    if (autoEnabled === "true") {
      try {
        autoSubmissionResult = await Decision.autoCreateDecisionsForChallenge({
          challengeId: challenge._id,
          organizationId,
          clerkUserId,
          options: {
            model: process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
            concurrency: Number(process.env.AUTO_SUBMISSION_CONCURRENCY || 10),
          },
        });
      } catch (e) {
        // Don't fail publish; return error details for visibility
        autoSubmissionResult = {
          skipped: false,
          error: e?.message || String(e),
        };
      }
    }

    res.json({
      success: true,
      message: "Challenge published successfully",
      data: challenge,
      autoSubmissionResult,
    });
  } catch (error) {
    console.error("Error publishing challenge:", error);
    if (error.message.includes("already published")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Unpublish challenge
 * POST /api/admin/challenges/:challengeId/unpublish
 */
exports.unpublishScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge as Mongoose document (needed for instance methods)
    const challenge = await Challenge.findOne({
      _id: challengeId,
      organization: organizationId,
    });

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    // Check if challenge is published
    if (!challenge.isPublished) {
      return res.status(400).json({
        error: "Challenge is not published",
      });
    }

    // Check if challenge is closed
    if (challenge.isClosed) {
      return res.status(400).json({
        error: "Cannot unpublish a closed challenge",
      });
    }

    // Unpublish challenge
    await challenge.unpublish(clerkUserId);

    res.json({
      success: true,
      message: "Challenge unpublished successfully",
      data: challenge,
    });
  } catch (error) {
    console.error("Error unpublishing challenge:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Preview AI outcomes (placeholder)
 * POST /api/admin/challenges/:challengeId/preview
 */
exports.previewScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge
    const challenge = await Challenge.getScenarioById(challengeId, organizationId);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    // Get outcome
    const outcome = await Outcome.getOutcomeByScenario(challengeId);

    if (!outcome) {
      return res.status(400).json({
        error: "Challenge outcome must be set before previewing",
      });
    }

    // Create preview jobs (dryRun = true)
    const jobs = await JobService.createJobsForScenario(
      challengeId,
      challenge.classroomId,
      true, // dryRun
      organizationId,
      clerkUserId
    );

    // Process preview jobs synchronously (limited to first 5 for preview)
    const previewJobs = jobs.slice(0, 5);
    const previewResults = [];

    for (const job of previewJobs) {
      try {
        const result = await SimulationWorker.processJob(job._id);
        previewResults.push({
          userId: job.userId,
          result: result.result,
        });
      } catch (error) {
        console.error(`Error processing preview job ${job._id}:`, error);
        previewResults.push({
          userId: job.userId,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: "Preview completed",
      data: {
        challenge: challenge.toObject(),
        outcome: outcome.toObject(),
        previewResults,
        totalJobs: jobs.length,
        previewedJobs: previewResults.length,
      },
    });
  } catch (error) {
    console.error("Error previewing challenge:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Rerun challenge (placeholder)
 * POST /api/admin/challenges/:challengeId/rerun
 */
exports.rerunScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge
    const challenge = await Challenge.getScenarioById(challengeId, organizationId);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    // Get outcome
    const outcome = await Outcome.getOutcomeByScenario(challengeId);

    if (!outcome) {
      return res.status(400).json({
        error: "Challenge outcome must be set before rerunning",
      });
    }

    // 1. Delete existing ledger entries for this challenge
    await LedgerEntry.deleteLedgerEntriesForScenario(challengeId);

    // 2. Reset all jobs for this challenge
    await JobService.resetJobsForScenario(challengeId);

    // 3. Recreate jobs for all decisions
    // Jobs are automatically enqueued to Bull queue by createJobsForScenario -> createJob
    // The Bull queue worker will process them asynchronously
    const simulationMode = String(process.env.SIMULATION_MODE || "direct");
    const useBatch = simulationMode === "batch";
    const jobs = await JobService.createJobsForScenario(
      challengeId,
      challenge.classroomId,
      false, // dryRun = false
      organizationId,
      clerkUserId,
      { enqueue: !useBatch }
    );

    if (useBatch) {
      await enqueueSimulationBatchSubmit({
        challengeId,
        classroomId: challenge.classroomId,
        organizationId,
        clerkUserId,
      });
    }

    res.json({
      success: true,
      message:
        "Challenge rerun initiated. Jobs created and queued for processing.",
      data: {
        challenge: challenge, // getScenarioById already returns a plain object
        jobsCreated: jobs.length,
      },
    });
  } catch (error) {
    console.error("Error rerunning challenge:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Cancel any in-progress OpenAI batch, reset jobs, and rerun challenge outcome.
 * POST /api/admin/challenges/:challengeId/cancel-batch-and-rerun
 */
exports.cancelBatchAndRerunScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Fetch a Mongoose document so the existing close() lifecycle method can
    // reconcile challenges left open/FAILED by an earlier processing error.
    const challenge = await Challenge.findOne({
      _id: challengeId,
      organization: organizationId,
    });

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    // Get outcome (required for rerun)
    const outcome = await Outcome.getOutcomeByScenario(challengeId);

    if (!outcome) {
      return res.status(400).json({
        error: "Challenge outcome must be set before rerunning",
      });
    }

    // 1. Cancel any in-progress OpenAI batch (batch mode only)
    let batchCancelled = false;
    let openaiBatchId = null;
    const simulationMode = String(process.env.SIMULATION_MODE || "direct");
    if (simulationMode === "batch") {
      const cancelResult =
        await SimulationBatch.cancelInProgressBatchForScenario(challengeId);
      batchCancelled = cancelResult.cancelled;
      openaiBatchId = cancelResult.openaiBatchId || null;
    }

    // 2. Reset all jobs for this challenge
    await JobService.resetJobsForScenario(challengeId);

    // 3. Delete existing ledger entries
    await LedgerEntry.deleteLedgerEntriesForScenario(challengeId);

    // 4. Recreate jobs and enqueue
    const useBatch = simulationMode === "batch";
    const jobs = await JobService.createJobsForScenario(
      challengeId,
      challenge.classroomId,
      false, // dryRun = false
      organizationId,
      clerkUserId,
      { enqueue: !useBatch }
    );

    if (useBatch) {
      await enqueueSimulationBatchSubmit({
        challengeId,
        classroomId: challenge.classroomId,
        organizationId,
        clerkUserId,
      });
    }

    // Outcome processing normally closes the challenge after successfully
    // enqueueing simulations. Apply the same lifecycle transition here so a
    // recovery rerun clears any stale FAILED status instead of leaving a
    // completed simulation attached to an open/failed challenge.
    await challenge.close(clerkUserId);

    res.json({
      success: true,
      message: "Batch cancelled and challenge rerun initiated.",
      data: {
        batchCancelled,
        openaiBatchId,
        jobsCreated: jobs.length,
        challenge,
      },
    });
  } catch (error) {
    console.error("Error in cancel-batch-and-rerun:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get current challenge (student-facing)
 * GET /api/student/challenge/current
 */
exports.getCurrentScenario = async function (req, res) {
  try {
    const { classroomId } = req.query;
    const member = req.user;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    // Verify enrollment
    const isEnrolled = await Enrollment.isUserEnrolled(classroomId, member._id);

    if (!isEnrolled) {
      return res.status(403).json({
        error: "Not enrolled in this class",
      });
    }

    const challenge = await Challenge.getActiveScenario(classroomId);

    if (!challenge) {
      // Treat "no current challenge" as an empty state, not an error
      return res.status(200).json({ success: true, data: null });
    }

    // Ensure challenge is published (additional safety check)
    if (!challenge.isPublished) {
      // Treat "no current challenge" as an empty state, not an error
      return res.status(200).json({ success: true, data: null });
    }

    // Get decision status for this student
    const decision = await Decision.getSubmission(
      classroomId,
      challenge._id,
      member._id
    );

    const submissionStatus = decision
      ? {
          submitted: true,
          submittedAt: decision.submittedAt,
        }
      : {
          submitted: false,
          submittedAt: null,
        };

    res.json({
      success: true,
      data: {
        challenge: {
          id: challenge._id,
          title: challenge.title,
          description: challenge.description,
          variables: challenge.variables,
          isPublished: challenge.isPublished,
          isClosed: challenge.isClosed,
          week: challenge.week,
          publishAt: challenge.publishAt,
          submissionDeadlineAt: challenge.submissionDeadlineAt,
          automationMode: challenge.automationMode,
          automationStatus: challenge.automationStatus,
        },
        submissionStatus,
      },
    });
  } catch (error) {
    console.error("Error getting current challenge:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get current challenge (admin-facing)
 * GET /api/admin/challenges/current
 */
exports.getCurrentScenarioForAdmin = async function (req, res) {
  try {
    const { classroomId } = req.query;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get active challenge
    const challenge = await Challenge.getActiveScenario(classroomId);

    if (!challenge) {
      // Treat "no current challenge" as an empty state, not an error
      return res.status(200).json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        challenge: {
          id: challenge._id,
          title: challenge.title,
          description: challenge.description,
          variables: challenge.variables,
          isPublished: challenge.isPublished,
          isClosed: challenge.isClosed,
          publishAt: challenge.publishAt,
          submissionDeadlineAt: challenge.submissionDeadlineAt,
          automationMode: challenge.automationMode,
          automationStatus: challenge.automationStatus,
          automationError: challenge.automationError,
        },
      },
    });
  } catch (error) {
    console.error("Error getting current challenge for admin:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get student challenges by classroom
 * GET /api/student/challenges
 */
exports.getStudentScenariosByClassroom = async function (req, res) {
  try {
    const { classroomId: classroomId } = req.query;
    const member = req.user;

    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }

    // Verify enrollment
    const isEnrolled = await Enrollment.isUserEnrolled(classroomId, member._id);
    if (!isEnrolled) {
      return res.status(403).json({ error: "Not enrolled in this class" });
    }

    // Get all challenges for the classroom
    const challenges = await Challenge.getScenariosByClass(classroomId, {
      includeClosed: true,
    });

    // Filter to only include published challenges
    const publishedScenarios = challenges.filter(
      (challenge) => challenge.isPublished === true
    );

    // For each challenge, fetch decision, outcome, and ledger entry
    const scenariosWithData = await Promise.all(
      publishedScenarios.map(async (challenge) => {
        // Get member decision with variables for this challenge
        const decision = await Decision.getSubmission(
          classroomId,
          challenge._id,
          member._id
        );

        // Get challenge outcome
        const outcome = await Outcome.getOutcomeByScenario(
          challenge._id
        );

        // Get ledger entry for this challenge and member
        const ledgerEntry = await LedgerEntry.getLedgerEntry(
          challenge._id,
          member._id
        );

        const safeOutcome = outcome
          ? {
              ...outcome.toObject(),
              hiddenNotes: undefined,
            }
          : null;

        return {
          ...challenge,
          decision: decision || null,
          outcome: safeOutcome,
          ledgerEntry: ledgerEntry || null,
        };
      })
    );

    res.json({
      success: true,
      data: scenariosWithData,
    });
  } catch (error) {
    console.error("Error getting student challenges by classroom:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid id provided" });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get challenge by id for student
 * GET /api/student/challenges/:id
 */
exports.getScenarioByIdForStudent = async function (req, res) {
  try {
    const { id } = req.params;
    const member = req.user;

    // Get challenge by id (without organizationId for students)
    const challenge = await Challenge.getScenarioById(id);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Only return published challenges for students
    if (!challenge.isPublished) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify enrollment
    const isEnrolled = await Enrollment.isUserEnrolled(
      challenge.classroomId,
      member._id
    );
    if (!isEnrolled) {
      return res.status(403).json({ error: "Not enrolled in this class" });
    }

    // Get member decision with variables for this challenge
    const decision = await Decision.getSubmission(
      challenge.classroomId,
      challenge._id,
      member._id
    );

    // Get challenge outcome
    const outcome = await Outcome.getOutcomeByScenario(challenge._id);
    const safeOutcome = outcome
      ? {
          ...outcome.toObject(),
          hiddenNotes: undefined,
        }
      : null;

    // Get ledger entry for this challenge and member
    const ledgerEntry = await LedgerEntry.getLedgerEntry(
      challenge._id,
      member._id
    );

    res.json({
      success: true,
      data: {
        ...challenge,
        decision: decision || null,
        outcome: safeOutcome,
        ledgerEntry: ledgerEntry || null,
      },
    });
  } catch (error) {
    console.error("Error getting challenge by id for student:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid id provided" });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete challenge
 * DELETE /api/admin/challenges/:challengeId
 */
exports.deleteScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization?._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge to verify it exists and user has access
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    // Delete challenge and all related data (cascade delete)
    const deletedScenario = await Challenge.deleteScenario(challengeId);

    if (!deletedScenario) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    res.json({
      success: true,
      message: "Challenge and all related data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting challenge:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
/**
 * Export challenge decisions as CSV
 * GET /api/admin/challenges/:challengeId/export
 */
exports.exportScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    const challenge = await Challenge.getScenarioById(challengeId, organizationId);
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });

    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    // ✅ generate CSV content (string or Buffer)
    const result = await Challenge.processScenarioExport(
      challengeId,
      organizationId
    );

    // Tell browser to download it
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    // optional: helps with proxies/buffers
    res.setHeader("Content-Length", Buffer.byteLength(result.csv, "utf8"));

    return res.status(200).send(result.csv);
  } catch (error) {
    console.error("Error exporting challenge:", error);
    if (error.message === "Class not found")
      return res.status(404).json({ error: error.message });
    if (error.message.includes("Insufficient permissions"))
      return res.status(403).json({ error: error.message });
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Release feedback manually
 * POST /api/admin/challenges/:challengeId/release-feedback
 */
exports.releaseFeedbackScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge as Mongoose document
    const challenge = await Challenge.findOne({
      _id: challengeId,
      organization: organizationId,
    });

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    if (challenge.isFeedbackReleased) {
      return res.status(400).json({
        error: "Feedback is already released",
      });
    }

    challenge.isFeedbackReleased = true;
    challenge.automationStatus = "feedbackReleased";
    challenge.automationLastCheckedAt = new Date();
    await challenge.save();

    // Trigger student notifications in bulk
    await LedgerEntry.sendResultsNotifications(challenge._id);

    res.json({
      success: true,
      message: "Feedback released successfully and notifications sent.",
      data: challenge,
    });
  } catch (error) {
    console.error("Error releasing feedback:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
