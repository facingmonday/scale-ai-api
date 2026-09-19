const Challenge = require("../challenge/challenge.model");
const ChallengeEmail = require("../challenge/challengeEmail.model");

async function getCalendarReminders({ classroomId, organizationId }) {
  const challenges = await Challenge.find({ classroomId, organization: organizationId })
    .select("_id").lean();
  if (!challenges.length) return [];
  // Reminder documents have no classroomId. Scope them through this classroom's
  // challenge IDs as well as organization, and never return recipients or errors.
  return ChallengeEmail.find({
    organization: organizationId,
    challengeId: { $in: challenges.map((challenge) => challenge._id) },
    kind: "scheduled",
    status: "scheduled",
  }).select("_id challengeId sendAt").sort({ sendAt: 1, _id: 1 }).lean();
}

module.exports = { getCalendarReminders };
