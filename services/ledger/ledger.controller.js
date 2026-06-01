const LedgerEntry = require("./ledger.model");
const Classroom = require("../classroom/classroom.model");
const Challenge = require("../challenge/challenge.model");
const Member = require("../members/member.model");

/**
 * Get ledger history for a user
 * GET /api/admin/ledger/:classroomId/user/:userId
 * Note: userId in the URL is a Clerk user ID, we need to convert it to Member ID
 */
exports.getLedgerHistory = async function (req, res) {
  try {
    const { classroomId, userId: clerkUserId } = req.params;

    const member = await Member.findByClerkUserId(clerkUserId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const history = await LedgerEntry.getLedgerHistory(classroomId, member._id);

    const includeCalculationDetails =
      req.query.includeCalculationDetails === "true";

    let historyData = history.map((entry) => entry.toObject());

    // Filter out ledger entries for unreleased feedback if the requester is a student
    const callingClerkUserId = req.clerkUser?.id;
    const isSelf = callingClerkUserId === clerkUserId;
    const callerMember = await Member.findOne({ clerkUserId: callingClerkUserId }).lean();
    const isOrgAdmin = callerMember?.organizationMemberships?.some(
      (m) =>
        m.organizationId?.toString() === req.organization?._id?.toString() &&
        m.role === "org:admin"
    );
    const isStudent = isSelf && !isOrgAdmin;

    if (isStudent) {
      historyData = historyData.filter((entry) => {
        const chal = entry.challengeId;
        if (!chal) return true; // Initial entry (week 0) has no challengeId, always visible
        const isReleased = chal.isFeedbackReleased || (chal.isClosed && !chal.feedbackReleaseMode);
        return isReleased === true;
      });
    }

    if (includeCalculationDetails) {
      const detailsPromises = history.map((entry) =>
        LedgerEntry.getCalculationDetails(entry._id)
      );
      const detailsResults = await Promise.all(detailsPromises);

      historyData = historyData.map((entry, index) => {
        const details = detailsResults[index];
        if (details) {
          entry.calculationDetails = details.calculationContext;
          entry.variableDefinitions = details.variableDefinitions;
          entry.metricDefinitions = details.metricDefinitions;
        }
        return entry;
      });
    }

    res.json({ success: true, data: historyData });
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
 * Get ledger entries for a challenge (challenge)
 * GET /api/admin/ledger/challenge/:challengeId
 */
exports.getLedgerEntriesByChallenge = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    const challenge = await Challenge.getScenarioById(
      challengeId,
      organizationId
    );
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    const entries = await LedgerEntry.getLedgerEntriesByChallenge(challengeId);

    const includeCalculationDetails =
      req.query.includeCalculationDetails === "true";

    let entriesData = entries.map((entry) => entry.toObject());

    if (includeCalculationDetails) {
      const detailsPromises = entries.map((entry) =>
        LedgerEntry.getCalculationDetails(entry._id)
      );
      const detailsResults = await Promise.all(detailsPromises);

      entriesData = entriesData.map((entry, index) => {
        const details = detailsResults[index];
        if (details) {
          entry.calculationDetails = details.calculationContext;
          entry.variableDefinitions = details.variableDefinitions;
          entry.metricDefinitions = details.metricDefinitions;
        }
        return entry;
      });
    }

    res.json({ success: true, data: entriesData });
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
    const clerkUserId = req.clerkUser.id;

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
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get ledger entry for a specific challenge and user
 * GET /api/admin/ledger/challenge/:challengeId/user/:userId
 * Note: userId in the URL is a Clerk user ID
 */
exports.getLedgerEntry = async function (req, res) {
  try {
    const { challengeId, userId: clerkUserId } = req.params;
    const organizationId = req.organization._id;
    const adminClerkUserId = req.clerkUser.id;

    const challenge = await Challenge.getScenarioById(
      challengeId,
      organizationId
    );
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    await Classroom.validateAdminAccess(
      challenge.classroomId,
      adminClerkUserId,
      organizationId
    );

    const member = await Member.findByClerkUserId(clerkUserId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const entry = await LedgerEntry.getLedgerEntry(challengeId, member._id);
    if (!entry) {
      return res.status(404).json({ error: "Ledger entry not found" });
    }

    const details = await LedgerEntry.getCalculationDetails(entry._id);
    const entryData = entry.toObject();

    if (details) {
      entryData.calculationDetails = details.calculationContext;
      entryData.variableDefinitions = details.variableDefinitions;
      entryData.metricDefinitions = details.metricDefinitions;
    }

    res.json({ success: true, data: entryData });
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
