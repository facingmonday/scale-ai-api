const ScenarioOutcome = require("./scenarioOutcome.model");
const Scenario = require("../scenario/scenario.model");
const Classroom = require("../classroom/classroom.model");
const {
  enqueueOutcomeProcessing,
} = require("../../lib/queues/outcome-processing-worker");
/**
 * Set scenario outcome
 * POST /api/admin/scenarios/:scenarioId/outcome
 * This enqueues a background job to:
 * - auto-generate missing submissions (optional)
 * - create simulation jobs
 * - enqueue batch submit (if enabled)
 * - close the scenario
 */
exports.setScenarioOutcome = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const {
      notes,
      randomEventChancePercent,
      autoGenerateSubmissionsOnOutcome,
      punishAbsentStudents,
      variables,
    } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario (need Mongoose document for instance methods)
    const query = { _id: scenarioId };
    if (organizationId) {
      query.organization = organizationId;
    }
    const scenario = await Scenario.findOne(query);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classroomId,
      clerkUserId,
      organizationId
    );

    // Check if scenario is already closed
    if (scenario.isClosed) {
      return res.status(400).json({
        error: "Scenario is already closed",
      });
    }

    // Create or update outcome using static method (classroomId for variable plugin)
    const outcome = await ScenarioOutcome.createOrUpdateOutcome(
      scenarioId,
      {
        classroomId: scenario.classroomId,
        notes,
        randomEventChancePercent,
        autoGenerateSubmissionsOnOutcome,
        punishAbsentStudents,
        variables,
      },
      organizationId,
      clerkUserId
    );

    // Enqueue background processing so the API request stays fast and stable.
    const queuedJob = await enqueueOutcomeProcessing({
      scenarioId,
      organizationId,
      clerkUserId,
    });

    res.json({
      success: true,
      message:
        "Scenario outcome set successfully. Background processing job queued.",
      data: {
        outcome,
        outcomeProcessingJobId: queuedJob?.id,
      },
    });
  } catch (error) {
    console.error("Error setting scenario outcome:", error);
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
 * Get scenario outcome by scenario ID
 * GET /api/admin/scenarios/:scenarioId/outcome
 */
exports.getScenarioOutcome = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;

    // Find scenario
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Get outcome
    const outcome = await ScenarioOutcome.getOutcomeByScenario(scenarioId);

    if (!outcome) {
      // Outcome may legitimately not exist yet (scenario not closed / instructor hasn't set it).
      // Return a stable 200 response with null data instead of a 404.
      return res.status(200).json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: outcome,
    });
  } catch (error) {
    console.error("Error getting scenario outcome:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete scenario outcome by scenario ID
 * DELETE /api/admin/scenarioOutcomes/:scenarioId/outcome
 */
exports.deleteScenarioOutcome = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario (need Mongoose document for instance methods)
    const query = { _id: scenarioId };
    if (organizationId) {
      query.organization = organizationId;
    }
    const scenario = await Scenario.findOne(query);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classroomId,
      clerkUserId,
      organizationId
    );

    // Delete outcome
    await ScenarioOutcome.deleteOutcome(scenarioId);

    // Set isClosed to false
    await scenario.open(clerkUserId);

    res.json({
      success: true,
      message: "Scenario outcome deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting scenario outcome:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
