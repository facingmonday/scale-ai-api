const ScenarioOutcome = require("./scenarioOutcome.model");
const Scenario = require("../scenario/scenario.model");
const Classroom = require("../classroom/classroom.model");
const JobService = require("../job/lib/jobService");

/**
 * Set scenario outcome
 * POST /api/admin/scenarios/:scenarioId/outcome
 * This automatically closes the scenario and creates jobs for processing
 */
exports.setScenarioOutcome = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const { notes, randomEventsEnabled } = req.body;
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

    // Create or update outcome using static method
    const outcome = await ScenarioOutcome.createOrUpdateOutcome(
      scenarioId,
      { notes, randomEventsEnabled },
      organizationId,
      clerkUserId
    );

    // Create jobs for all submissions (dryRun = false, will write to ledger)
    const jobs = await JobService.createJobsForScenario(
      scenarioId,
      scenario.classroomId,
      false, // dryRun = false, will write to ledger
      organizationId,
      clerkUserId
    );

    // Close scenario
    await scenario.close(clerkUserId);

    res.json({
      success: true,
      message:
        "Scenario outcome set successfully. Scenario closed and jobs queued for processing.",
      data: {
        outcome,
        jobsCreated: jobs.length,
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
      return res.status(404).json({ error: "Scenario outcome not found" });
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
