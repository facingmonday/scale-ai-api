const Enrollment = require("../enrollment/enrollment.model");
const Profile = require("../profile/profile.model");
const Decision = require("./decision.model");
const Challenge = require("../challenge/challenge.model");
const Member = require("../members/member.model");

const ProfileType = require("../profileType/profileType.model");
const {
  generateSubmissionVariablesForStoreType,
} = require("./autoDecisionGenerator");

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let idx = 0;
  const workers = new Array(Math.max(1, concurrency))
    .fill(null)
    .map(async () => {
      while (idx < items.length) {
        const current = idx++;
        results[current] = await mapper(items[current], current);
      }
    });
  await Promise.all(workers);
  return results;
}

/**
 * Auto-create a Decision for every enrolled student in the class for a published challenge.
 * Uses one LLM call per profileType, then reuses the generated values for all students of that type.
 *
 * @param {Object} params
 * @param {string} params.challengeId - Challenge ID
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.clerkUserId - Clerk user ID
 * @param {Object} [params.options] - Options object
 * @param {string} [params.punishAbsentStudents] - Optional: "high", "medium", "low" to punish absent students
 */
async function autoCreateDecisionsForChallenge({
  challengeId,
  organizationId,
  clerkUserId,
  options = {},
  punishAbsentStudents,
}) {
  const {
    model = process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
    concurrency = 10,
    includeExisting = false, // if true, skips create errors but counts them as existing
  } = options;

  if (!process.env.OPENAI_API_KEY) {
    return {
      skipped: true,
      reason: "OPENAI_API_KEY not set",
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  const challenge = await Challenge.findOne({
    _id: challengeId,
    organization: organizationId,
  });
  if (!challenge) {
    throw new Error("Challenge not found");
  }
  if (!challenge.isPublished || challenge.isClosed) {
    // createSubmission requires published + not closed
    return {
      skipped: true,
      reason: "Challenge not published or already closed",
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  const classroomId = challenge.classroomId;
  const hydratedScenario = await Challenge.getScenarioById(
    challengeId,
    organizationId
  );

  // Enrollments (students only)
  const enrollments = await Enrollment.findByClassAndRole(
    classroomId,
    "member"
  );
  if (!enrollments || enrollments.length === 0) {
    return {
      skipped: false,
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  // Load members (to pass correct clerkUserId for decision createdBy/updatedBy if desired)
  const studentIds = enrollments.map((e) => e.userId);
  const members = await Member.find({ _id: { $in: studentIds } })
    .select("_id clerkUserId")
    .lean();
  const clerkByMemberId = new Map(
    members.map((m) => [m._id.toString(), m.clerkUserId])
  );

  // Load profiles for all students
  const profiles = await Profile.find({ classroomId, userId: { $in: studentIds } })
    .select("userId profileType")
    .lean();
  const storeByUserId = new Map(profiles.map((s) => [s.userId.toString(), s]));

  // Group students by profileType
  const studentsByStoreTypeId = new Map(); // storeTypeId -> [{ userId, clerkUserId }]
  let missingStore = 0;

  for (const enrollment of enrollments) {
    const uid = enrollment.userId.toString();
    const profile = storeByUserId.get(uid);
    if (!profile) {
      missingStore += 1;
      continue;
    }
    const storeTypeId =
      profile.profileType?.toString?.() || String(profile.profileType);
    if (!studentsByStoreTypeId.has(storeTypeId))
      studentsByStoreTypeId.set(storeTypeId, []);
    studentsByStoreTypeId.get(storeTypeId).push({
      userId: enrollment.userId,
      clerkUserId: clerkByMemberId.get(uid) || clerkUserId, // fallback to admin
    });
  }

  // Normalize punishment level (case-insensitive) if provided
  let absentPunishmentLevel = null;
  // TODO: JMP removed punishment from decision and added to the decision processing logic
  // if (punishAbsentStudents) {
  //   const normalized =
  //     typeof punishAbsentStudents === "string"
  //       ? punishAbsentStudents.toLowerCase()
  //       : String(punishAbsentStudents).toLowerCase();
  //   // Only set punishment level if it's not "none"
  //   if (
  //     normalized !== "none" &&
  //     normalized !== null &&
  //     normalized !== undefined
  //   ) {
  //     absentPunishmentLevel = normalized;
  //   }
  // }

  // Generate one decision vars object per profileType
  const generatedByStoreType = new Map();
  const storeTypeIds = Array.from(studentsByStoreTypeId.keys());
  const storeTypeDocs = await ProfileType.find({
    _id: { $in: storeTypeIds },
    organization: organizationId,
    isActive: true,
  });
  // Ensure variables are loaded (profileType is organization-scoped, so we load manually)
  await Promise.all(storeTypeDocs.map((st) => st._loadVariables()));
  const storeTypeById = new Map(
    storeTypeDocs.map((st) => [st._id.toString(), st])
  );

  for (const [storeTypeId] of studentsByStoreTypeId) {
    const storeTypeDoc = storeTypeById.get(storeTypeId);
    if (!storeTypeDoc) {
      throw new Error(`ProfileType not found or inactive: ${storeTypeId}`);
    }
    const vars = await generateSubmissionVariablesForStoreType({
      classroomId,
      storeTypeKey: storeTypeDoc.key,
      storeTypeVariables: storeTypeDoc.variables || {},
      challenge: hydratedScenario,
      organizationId,
      clerkUserId,
      model,
      absentPunishmentLevel, // Pass absence punishment level to AI
    });
    generatedByStoreType.set(storeTypeId, vars);
  }

  // Flatten tasks to create decisions
  const tasks = [];
  for (const [storeTypeId, students] of studentsByStoreTypeId) {
    for (const s of students) tasks.push({ storeTypeId, ...s });
  }

  let created = 0;
  let existing = 0;
  const errors = [];

  await mapWithConcurrency(tasks, concurrency, async (task) => {
    const vars = generatedByStoreType.get(task.storeTypeId);
    try {
      await Decision.createSubmission(
        classroomId,
        challengeId,
        task.userId,
        vars,
        organizationId,
        task.clerkUserId,
        {
          generation: {
            method: "AI",
            meta: {
              model,
              absentPunishmentLevel,
              note: "Auto-created on challenge outcome (USE_AI)",
            },
          },
        }
      );
      created += 1;
    } catch (e) {
      // Common case: already exists
      if (String(e?.message || "").includes("Decision already exists")) {
        existing += 1;
        return;
      }
      if (includeExisting) {
        existing += 1;
        return;
      }
      errors.push({
        userId: task.userId?.toString?.() || String(task.userId),
        storeTypeId: task.storeTypeId,
        error: e?.message || String(e),
      });
    }
  });

  return {
    skipped: false,
    created,
    existing,
    missingStore,
    errors,
    storeTypeIds: Array.from(studentsByStoreTypeId.keys()),
  };
}

module.exports = { autoCreateDecisionsForChallenge };
