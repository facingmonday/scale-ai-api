const LedgerService = require("./lib/ledgerService");
const classroomService = require("../classroom/lib/classroomService");
const Scenario = require("../scenario/scenario.model");
const Member = require("../members/member.model");

/**
 * Get ledger history for a user
 * GET /api/admin/ledger/:classId/user/:userId
 */
exports.getLedgerHistory = async function (req, res) {
  try {
    const { classId, userId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Verify admin access
    await classroomService.validateAdminAccess(
      classId,
      clerkUserId,
      organizationId
    );

    const history = await LedgerService.getLedgerHistory(classId, userId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error getting ledger history:", error);
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
 * Get ledger entries for a scenario
 * GET /api/admin/ledger/scenario/:scenarioId
 */
exports.getLedgerEntriesByScenario = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario to get classId
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await classroomService.validateAdminAccess(
      scenario.classId,
      clerkUserId,
      organizationId
    );

    const entries = await LedgerService.getLedgerEntriesByScenario(scenarioId);

    res.json({
      success: true,
      data: entries,
    });
  } catch (error) {
    console.error("Error getting ledger entries:", error);
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
 * Override a ledger entry
 * PATCH /api/admin/ledger/:ledgerId/override
 */
exports.overrideLedgerEntry = async function (req, res) {
  try {
    const { ledgerId } = req.params;
    const patch = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Get admin member ID
    const adminMember = await Member.findOne({ clerkUserId });
    if (!adminMember) {
      return res.status(404).json({ error: "Admin member not found" });
    }

    const entry = await LedgerService.overrideLedgerEntry(
      ledgerId,
      patch,
      clerkUserId,
      adminMember._id
    );

    res.json({
      success: true,
      message: "Ledger entry overridden successfully",
      data: entry,
    });
  } catch (error) {
    console.error("Error overriding ledger entry:", error);
    if (error.message === "Ledger entry not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Cash continuity error")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get ledger entry for a specific scenario and user
 * GET /api/admin/ledger/scenario/:scenarioId/user/:userId
 */
exports.getLedgerEntry = async function (req, res) {
  try {
    const { scenarioId, userId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario to get classId
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await classroomService.validateAdminAccess(
      scenario.classId,
      clerkUserId,
      organizationId
    );

    const entry = await LedgerService.getLedgerEntry(scenarioId, userId);

    if (!entry) {
      return res.status(404).json({ error: "Ledger entry not found" });
    }

    res.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error("Error getting ledger entry:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

