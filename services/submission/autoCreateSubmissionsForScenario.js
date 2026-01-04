const Enrollment = require("../enrollment/enrollment.model");
const Store = require("../store/store.model");
const Submission = require("./submission.model");
const Scenario = require("../scenario/scenario.model");
const Member = require("../members/member.model");

const StoreType = require("../storeType/storeType.model");
const {
  generateSubmissionVariablesForStoreType,
} = require("./autoSubmissionGenerator");

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
 * Auto-create a Submission for every enrolled student in the class for a published scenario.
 * Uses one LLM call per storeType, then reuses the generated values for all students of that type.
 *
 * @param {Object} params
 * @param {string} params.scenarioId - Scenario ID
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.clerkUserId - Clerk user ID
 * @param {Object} [params.options] - Options object
 * @param {string} [params.punishAbsentStudents] - Optional: "high", "medium", "low" to punish absent students
 */
async function autoCreateSubmissionsForScenario({
  scenarioId,
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

  const scenario = await Scenario.findOne({
    _id: scenarioId,
    organization: organizationId,
  });
  if (!scenario) {
    throw new Error("Scenario not found");
  }
  if (!scenario.isPublished || scenario.isClosed) {
    // createSubmission requires published + not closed
    return {
      skipped: true,
      reason: "Scenario not published or already closed",
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  const classroomId = scenario.classroomId;
  const hydratedScenario = await Scenario.getScenarioById(
    scenarioId,
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

  // Load members (to pass correct clerkUserId for submission createdBy/updatedBy if desired)
  const studentIds = enrollments.map((e) => e.userId);
  const members = await Member.find({ _id: { $in: studentIds } })
    .select("_id clerkUserId")
    .lean();
  const clerkByMemberId = new Map(
    members.map((m) => [m._id.toString(), m.clerkUserId])
  );

  // Load stores for all students
  const stores = await Store.find({ classroomId, userId: { $in: studentIds } })
    .select("userId storeType")
    .lean();
  const storeByUserId = new Map(stores.map((s) => [s.userId.toString(), s]));

  // Group students by storeType
  const studentsByStoreTypeId = new Map(); // storeTypeId -> [{ userId, clerkUserId }]
  let missingStore = 0;

  for (const enrollment of enrollments) {
    const uid = enrollment.userId.toString();
    const store = storeByUserId.get(uid);
    if (!store) {
      missingStore += 1;
      continue;
    }
    const storeTypeId =
      store.storeType?.toString?.() || String(store.storeType);
    if (!studentsByStoreTypeId.has(storeTypeId))
      studentsByStoreTypeId.set(storeTypeId, []);
    studentsByStoreTypeId.get(storeTypeId).push({
      userId: enrollment.userId,
      clerkUserId: clerkByMemberId.get(uid) || clerkUserId, // fallback to admin
    });
  }

  // Normalize punishment level (case-insensitive) if provided
  let absentPunishmentLevel = null;
  if (punishAbsentStudents) {
    const normalized =
      typeof punishAbsentStudents === "string"
        ? punishAbsentStudents.toLowerCase()
        : String(punishAbsentStudents).toLowerCase();
    // Only set punishment level if it's not "none"
    if (
      normalized !== "none" &&
      normalized !== null &&
      normalized !== undefined
    ) {
      absentPunishmentLevel = normalized;
    }
  }

  // Generate one submission vars object per storeType
  const generatedByStoreType = new Map();
  const storeTypeIds = Array.from(studentsByStoreTypeId.keys());
  const storeTypeDocs = await StoreType.find({
    _id: { $in: storeTypeIds },
    organization: organizationId,
    isActive: true,
  });
  // Ensure variables are loaded (storeType is organization-scoped, so we load manually)
  await Promise.all(storeTypeDocs.map((st) => st._loadVariables()));
  const storeTypeById = new Map(
    storeTypeDocs.map((st) => [st._id.toString(), st])
  );

  for (const [storeTypeId] of studentsByStoreTypeId) {
    const storeTypeDoc = storeTypeById.get(storeTypeId);
    if (!storeTypeDoc) {
      throw new Error(`StoreType not found or inactive: ${storeTypeId}`);
    }
    const vars = await generateSubmissionVariablesForStoreType({
      classroomId,
      storeTypeKey: storeTypeDoc.key,
      storeTypeVariables: storeTypeDoc.variables || {},
      scenario: hydratedScenario,
      organizationId,
      clerkUserId,
      model,
      absentPunishmentLevel, // Pass absence punishment level to AI
    });
    generatedByStoreType.set(storeTypeId, vars);
  }

  // Flatten tasks to create submissions
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
      await Submission.createSubmission(
        classroomId,
        scenarioId,
        task.userId,
        vars,
        organizationId,
        task.clerkUserId
      );
      created += 1;
    } catch (e) {
      // Common case: already exists
      if (String(e?.message || "").includes("Submission already exists")) {
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

module.exports = { autoCreateSubmissionsForScenario };
