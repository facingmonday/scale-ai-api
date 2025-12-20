const ScenarioOutcome = require("./scenarioOutcome.model");
const Scenario = require("../scenario/scenario.model");
const Classroom = require("../classroom/classroom.model");

/**
 * Set scenario outcome
 * POST /api/admin/scenarios/:scenarioId/outcome
 */
exports.setScenarioOutcome = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const { actualWeather, demandShift, notes, randomEventsEnabled } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classId,
      clerkUserId,
      organizationId
    );

    // Create or update outcome using static method
    const outcome = await ScenarioOutcome.createOrUpdateOutcome(
      scenarioId,
      { actualWeather, demandShift, notes, randomEventsEnabled },
      organizationId,
      clerkUserId
    );

    res.json({
      success: true,
      message: "Scenario outcome set successfully",
      data: outcome,
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
    console.log("scenarioId", scenarioId);
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(400).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classId,
      clerkUserId,
      organizationId
    );

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
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Approve scenario outcome
 * POST /api/admin/scenarios/:scenarioId/outcome/approve
 */
exports.approveScenarioOutcome = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classId,
      clerkUserId,
      organizationId
    );

    // Get outcome
    const outcome = await ScenarioOutcome.getOutcomeByScenario(scenarioId);

    if (!outcome) {
      return res.status(400).json({
        error: "Scenario outcome must be set before approving",
      });
    }

    // Approve outcome
    await outcome.approve(clerkUserId);

    res.json({
      success: true,
      message: "Scenario outcome approved successfully",
      data: outcome,
    });
  } catch (error) {
    console.error("Error approving scenario outcome:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
