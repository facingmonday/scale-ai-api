const Enrollment = require("../enrollment/enrollment.model");
const Store = require("../store/store.model");
const Submission = require("./submission.model");
const Scenario = require("../scenario/scenario.model");
const Member = require("../members/member.model");

const { getPreset } = require("../store/storeTypePresets");
const {
  generateSubmissionVariablesForStoreType,
} = require("./autoSubmissionGenerator");

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let idx = 0;
  const workers = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
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
 */
async function autoCreateSubmissionsForScenario({
  scenarioId,
  organizationId,
  clerkUserId,
  options = {},
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

  const scenario = await Scenario.findOne({ _id: scenarioId, organization: organizationId });
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
  const hydratedScenario = await Scenario.getScenarioById(scenarioId, organizationId);

  // Enrollments (students only)
  const enrollments = await Enrollment.findByClassAndRole(classroomId, "member");
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
  const clerkByMemberId = new Map(members.map((m) => [m._id.toString(), m.clerkUserId]));

  // Load stores for all students
  const stores = await Store.find({ classroomId, userId: { $in: studentIds } })
    .select("userId storeType")
    .lean();
  const storeByUserId = new Map(stores.map((s) => [s.userId.toString(), s]));

  // Group students by storeType
  const studentsByStoreType = new Map(); // storeType -> [{ userId, clerkUserId }]
  let missingStore = 0;

  for (const enrollment of enrollments) {
    const uid = enrollment.userId.toString();
    const store = storeByUserId.get(uid);
    if (!store) {
      missingStore += 1;
      continue;
    }
    const storeType = store.storeType;
    if (!studentsByStoreType.has(storeType)) studentsByStoreType.set(storeType, []);
    studentsByStoreType.get(storeType).push({
      userId: enrollment.userId,
      clerkUserId: clerkByMemberId.get(uid) || clerkUserId, // fallback to admin
    });
  }

  // Generate one submission vars object per storeType
  const generatedByStoreType = new Map();
  for (const [storeType] of studentsByStoreType) {
    const preset = getPreset(storeType);
    const vars = await generateSubmissionVariablesForStoreType({
      classroomId,
      storeType,
      storePreset: preset,
      scenario: hydratedScenario,
      organizationId,
      clerkUserId,
      model,
    });
    generatedByStoreType.set(storeType, vars);
  }

  // Flatten tasks to create submissions
  const tasks = [];
  for (const [storeType, students] of studentsByStoreType) {
    for (const s of students) tasks.push({ storeType, ...s });
  }

  let created = 0;
  let existing = 0;
  const errors = [];

  await mapWithConcurrency(tasks, concurrency, async (task) => {
    const vars = generatedByStoreType.get(task.storeType);
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
        storeType: task.storeType,
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
    storeTypes: Array.from(studentsByStoreType.keys()),
  };
}

module.exports = { autoCreateSubmissionsForScenario };


