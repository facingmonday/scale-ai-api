const LedgerEntry = require("./ledger.model");
const Classroom = require("../classroom/classroom.model");
const Scenario = require("../scenario/scenario.model");
const Member = require("../members/member.model");

/**
 * Get ledger history for a user
 * GET /api/admin/ledger/:classroomId/user/:userId
 * Note: userId in the URL is a Clerk user ID, we need to convert it to Member ID
 */
exports.getLedgerHistory = async function (req, res) {
  try {
    const { classroomId, userId: clerkUserId } = req.params;
    console.log("clerkUserId", clerkUserId);
    const adminClerkUserId = req.clerkUser.id;
    const organizationId = req.organization._id;

    // Convert Clerk user ID to Member ID
    const member = await Member.findByClerkUserId(clerkUserId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const history = await LedgerEntry.getLedgerHistory(classroomId, member._id);

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

    // Find scenario to get classroomId
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classroomId,
      clerkUserId,
      organizationId
    );

    const entries = await LedgerEntry.getLedgerEntriesByScenario(scenarioId);

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

    const entry = await LedgerEntry.overrideLedgerEntry(
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
 * Note: userId in the URL is a Clerk user ID, we need to convert it to Member ID
 */
exports.getLedgerEntry = async function (req, res) {
  try {
    const { scenarioId, userId: clerkUserId } = req.params;
    const organizationId = req.organization._id;
    const adminClerkUserId = req.clerkUser.id;

    // Find scenario to get classroomId
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classroomId,
      adminClerkUserId,
      organizationId
    );

    // Convert Clerk user ID to Member ID
    const member = await Member.findByClerkUserId(clerkUserId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const entry = await LedgerEntry.getLedgerEntry(scenarioId, member._id);

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
