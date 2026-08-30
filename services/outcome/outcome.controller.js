const Outcome = require("./outcome.model");
const Challenge = require("../challenge/challenge.model");
const Classroom = require("../classroom/classroom.model");
const Decision = require("../decision/decision.model");
const LedgerEntry = require("../ledger/ledger.model");
const {
  enqueueOutcomeProcessing,
} = require("../../lib/queues/outcome-processing-worker");
/**
 * Set challenge outcome
 * POST /api/admin/challenges/:challengeId/outcome
 * This enqueues a background job to:
 * - apply the challenge's scheduled missing-decision policy
 * - create simulation jobs
 * - enqueue batch submit (if enabled)
 * - close the challenge
 */
exports.setScenarioOutcome = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const { notes, hiddenNotes } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge (need Mongoose document for instance methods)
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

    // Check if challenge is already closed
    if (challenge.isClosed) {
      return res.status(400).json({
        error: "Challenge is already closed",
      });
    }

    // Create or update outcome using static method
    const outcome = await Outcome.createOrUpdateOutcome(
      challengeId,
      {
        notes,
        hiddenNotes,
        approved: true,
      },
      organizationId,
      clerkUserId,
      challenge.classroomId
    );

    // Enqueue background processing so the API request stays fast and stable.
    const queuedJob = await enqueueOutcomeProcessing({
      challengeId,
      organizationId,
      clerkUserId,
    });

    res.json({
      success: true,
      message:
        "Challenge outcome set successfully. Background processing job queued.",
      data: {
        outcome,
        outcomeProcessingJobId: queuedJob?.id,
      },
    });
  } catch (error) {
    console.error("Error setting challenge outcome:", error);
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
 * Save challenge outcome without starting background processing.
 * Used by scheduled challenges so teachers can preconfigure hidden outcomes.
 */
exports.saveScenarioOutcomeDraft = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const { notes, hiddenNotes } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    const query = { _id: challengeId };
    if (organizationId) {
      query.organization = organizationId;
    }
    const challenge = await Challenge.findOne(query);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    if (challenge.isClosed) {
      return res.status(400).json({
        error: "Challenge is already closed",
      });
    }

    const outcome = await Outcome.createOrUpdateOutcome(
      challengeId,
      {
        notes,
        hiddenNotes,
        approved: false,
      },
      organizationId,
      clerkUserId,
      challenge.classroomId
    );

    res.json({
      success: true,
      message: "Challenge outcome draft saved successfully.",
      data: outcome,
    });
  } catch (error) {
    console.error("Error saving challenge outcome draft:", error);
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
 * Process an existing outcome draft.
 */
exports.approveScenarioOutcome = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    const query = { _id: challengeId };
    if (organizationId) {
      query.organization = organizationId;
    }
    const challenge = await Challenge.findOne(query);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    if (challenge.isClosed) {
      return res.status(400).json({
        error: "Challenge is already closed",
      });
    }

    const outcome = await Outcome.getOutcomeByScenario(challengeId);
    if (!outcome) {
      return res.status(400).json({
        error: "Challenge outcome must be saved before approval",
      });
    }

    outcome.approved = true;
    outcome.updatedBy = clerkUserId;
    await outcome.save();

    const queuedJob = await enqueueOutcomeProcessing({
      challengeId,
      organizationId,
      clerkUserId,
    });

    res.json({
      success: true,
      message: "Challenge outcome processing job queued.",
      data: {
        outcome,
        outcomeProcessingJobId: queuedJob?.id,
      },
    });
  } catch (error) {
    console.error("Error approving challenge outcome:", error);
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
 * Get challenge outcome by challenge ID
 * GET /api/admin/challenges/:challengeId/outcome
 */
exports.getScenarioOutcome = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;

    // Find challenge
    const challenge = await Challenge.getScenarioById(challengeId, organizationId);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Get outcome
    const outcome = await Outcome.getOutcomeByScenario(challengeId);

    if (!outcome) {
      // Outcome may legitimately not exist yet (challenge not closed / instructor hasn't set it).
      // Return a stable 200 response with null data instead of a 404.
      return res.status(200).json({ success: true, data: null });
    }

    if (req.originalUrl?.includes("/student/")) {
      const decision = await Decision.getSubmission(
        challenge.classroomId,
        challengeId,
        req.user._id,
      );
      const ledgerEntry = await LedgerEntry.getLedgerEntry(
        challengeId,
        req.user._id,
      );
      const resultComplete =
        decision?.processingStatus === "completed" && !!ledgerEntry;
      const releaseAllowsViewing = challenge.feedbackReleaseMode === "IMMEDIATE"
        ? true
        : challenge.isFeedbackReleased ||
          (challenge.isClosed && !challenge.feedbackReleaseMode);

      if (!resultComplete || !releaseAllowsViewing) {
        return res.status(200).json({ success: true, data: null });
      }
    }

    const data = req.originalUrl?.includes("/student/")
      ? {
          ...outcome.toObject(),
          hiddenNotes: undefined,
        }
      : outcome;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error getting challenge outcome:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update outcome variables (replaces all values).
 * PUT /api/admin/challenges/:challengeId/outcome/variables
 */
exports.updateScenarioOutcomeVariables = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const { variables } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    const query = { _id: challengeId };
    if (organizationId) query.organization = organizationId;
    const challenge = await Challenge.findOne(query);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    // Ensure outcome exists (auto-create empty one bound to classroom)
    await Outcome.createOrUpdateOutcome(
      challengeId,
      {},
      organizationId,
      clerkUserId,
      challenge.classroomId
    );

    const outcome = await Outcome.updateVariables(
      challengeId,
      variables || {},
      organizationId,
      clerkUserId
    );

    res.json({
      success: true,
      message: "Outcome variables updated successfully",
      data: outcome,
    });
  } catch (error) {
    console.error("Error updating outcome variables:", error);
    if (error.message === "Outcome not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "Validation failed") {
      return res
        .status(400)
        .json({ error: error.message, details: error.details });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete challenge outcome by challenge ID
 * DELETE /api/admin/outcomes/:challengeId/outcome
 */
exports.deleteScenarioOutcome = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge (need Mongoose document for instance methods)
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

    // Delete outcome
    await Outcome.deleteOutcome(challengeId);

    // Set isClosed to false
    await challenge.open(clerkUserId);

    res.json({
      success: true,
      message: "Challenge outcome deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting challenge outcome:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
