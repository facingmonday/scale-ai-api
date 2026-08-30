const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const Challenge = require("../challenge/challenge.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");
const mapWithConcurrency = require("./lib/mapWithConcurrency");
const coerceValue = require("./lib/coerceValue");
const clampNumber = require("./lib/clampNumber");
const buildJsonSchemaFromDefinitions = require("./lib/buildJsonSchemaFromDefinitions");
const fillMissingWithDefaults = require("./lib/fillMissingWithDefaults");
const normalizeSelectAllowedValues = require("./lib/normalizeSelectAllowedValues");

function normalizeAbsencePunishmentLevel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["low", "medium", "high"].includes(normalized) ? normalized : null;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     Decision:
 *       type: object
 *       required:
 *         - classroomId
 *         - challengeId
 *         - userId
 *       properties:
 *         _id:
 *           type: string
 *         classroomId:
 *           type: string
 *         challengeId:
 *           type: string
 *         userId:
 *           type: string
 *         generation:
 *           type: object
 *           properties:
 *             method:
 *               type: string
 *               enum: [MANUAL, AI, FORWARDED_PREVIOUS, AI_FALLBACK, DEFAULTS]
 *             forwardedFromScenarioId:
 *               type: string
 *             forwardedFromSubmissionId:
 *               type: string
 *             meta:
 *               type: object
 *         submittedAt:
 *           type: string
 *           format: date-time
 *         ledgerEntryId:
 *           type: string
 *         jobs:
 *           type: array
 *           items:
 *             type: string
 *         processingStatus:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         variables:
 *           type: object
 *           description: Map of student decision variable values.
 *         challengeVariableAnswers:
 *           type: object
 *           description: Map of this student's answers to challenge-specific variables.
 */
const submissionSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Challenge",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  // Tracks how this decision was created (manual student decision vs automation).
  // NOTE: This is separate from createdBy/updatedBy (which may still be the student).
  generation: {
    method: {
      type: String,
      enum: ["MANUAL", "AI", "FORWARDED_PREVIOUS", "AI_FALLBACK", "DEFAULTS"],
      default: "MANUAL",
      index: true,
    },
    forwardedFromScenarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      default: null,
    },
    forwardedFromSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
      default: null,
    },
    // Arbitrary metadata for debugging/auditing (model name, reason, etc.)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  // Convenience pointer to the most recent ledger entry generated for this decision
  ledgerEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerEntry",
    default: null,
  },
  jobs: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SimulationJob",
      },
    ],
    default: [],
  },
  processingStatus: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  challengeVariableAnswers: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
}).add(baseSchema);

// Apply variable population plugin
submissionSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "decision",
  outputFormat: "valueMap",
});

// Compound indexes for performance
submissionSchema.index(
  { classroomId: 1, challengeId: 1, userId: 1 },
  { unique: true }
);
submissionSchema.index({ challengeId: 1, userId: 1 });
submissionSchema.index({ classroomId: 1, userId: 1 });
submissionSchema.index({ challengeId: 1 });
submissionSchema.index({ organization: 1, challengeId: 1 });
submissionSchema.index({ ledgerEntryId: 1 });

// Static methods - Shared utilities for decision operations

/**
 * Validate decision variables against VariableDefinition
 * @param {string} classroomId - Class ID
 * @param {Object} variables - Variables object to validate
 * @param {string} [challengeId] - Challenge ID (optional)
 * @returns {Promise<Object>} Validation result
 */
submissionSchema.statics.validateSubmissionVariables = async function (
  classroomId,
  variables,
  challengeId = null
) {
  return await VariableDefinition.validateValues(
    classroomId,
    "decision",
    variables,
    { challengeId }
  );
};

/**
 * Validate and normalize a student's answers to challenge-scoped variables.
 */
submissionSchema.statics.prepareChallengeVariableAnswers = async function (
  classroomId,
  challengeId,
  answers
) {
  const input =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? answers
      : {};
  const options = { challengeId };
  const validation = await VariableDefinition.validateValues(
    classroomId,
    "challenge",
    input,
    options
  );

  if (!validation.isValid) {
    throw new Error(
      `Invalid challenge variable answers: ${validation.errors
        .map((e) => e.message)
        .join(", ")}`
    );
  }

  const withDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    "challenge",
    input,
    options
  );

  return await VariableDefinition.filterVariablesByActiveDefinitions(
    classroomId,
    "challenge",
    withDefaults,
    options
  );
};

/**
 * Check if decision exists
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @param {string} userId - Member ID
 * @returns {Promise<boolean>} True if decision exists
 */
submissionSchema.statics.submissionExists = async function (
  classroomId,
  challengeId,
  userId
) {
  const count = await this.countDocuments({ classroomId, challengeId, userId });
  return count > 0;
};

/**
 * Create a decision
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @param {string} userId - Member ID
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created decision with variables populated
 */
submissionSchema.statics.createSubmission = async function (
  classroomId,
  challengeId,
  userId,
  variables,
  organizationId,
  clerkUserId,
  createOptions = {}
) {
  // Check if decision already exists
  const exists = await this.submissionExists(classroomId, challengeId, userId);
  if (exists) {
    throw new Error("Decision already exists for this challenge");
  }

  // Validate variables
  const validation = await this.validateSubmissionVariables(
    classroomId,
    variables,
    challengeId
  );
  if (!validation.isValid) {
    throw new Error(
      `Invalid decision variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    "decision",
    variables,
    { challengeId }
  );

  // Only persist variables with active definitions (exclude soft-deleted variables)
  const variablesToSave =
    await VariableDefinition.filterVariablesByActiveDefinitions(
      classroomId,
      "decision",
      variablesWithDefaults,
      { challengeId }
    );

  // Verify challenge is published and not closed
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }
  if (!challenge.isPublished) {
    throw new Error("Challenge is not published");
  }
  if (!Challenge.hasStarted(challenge)) {
    throw new Error("Challenge has not started yet");
  }
  if (challenge.isClosed) {
    throw new Error("Challenge is closed");
  }
  if (challenge.isLockedForStudents && (!createOptions?.generation || createOptions.generation.method === "MANUAL")) {
    throw new Error("Submissions are closed for this challenge");
  }

  // Older clients and automated submissions do not send this field. Use the
  // challenge's configured values as their backwards-compatible defaults.
  const configuredChallengeVariables = await challenge.getVariables();
  const challengeVariableAnswers = await this.prepareChallengeVariableAnswers(
    classroomId,
    challengeId,
    createOptions.challengeVariableAnswers ?? configuredChallengeVariables
  );

  // Create decision document
  const decision = new this({
    classroomId,
    challengeId,
    userId,
    submittedAt: new Date(),
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
    challengeVariableAnswers,
  });

  // Optional generation metadata (defaults to MANUAL if not provided)
  if (createOptions && typeof createOptions === "object") {
    const gen = createOptions.generation;
    if (gen && typeof gen === "object") {
      decision.generation = {
        method: gen.method || undefined,
        forwardedFromScenarioId: gen.forwardedFromScenarioId || null,
        forwardedFromSubmissionId: gen.forwardedFromSubmissionId || null,
        meta: gen.meta !== undefined ? gen.meta : null,
      };
    }
  }

  await decision.save();

  // Create variable values if provided
  if (variablesToSave && Object.keys(variablesToSave).length > 0) {
    const variableEntries = Object.entries(variablesToSave);
    const variableDocs = variableEntries.map(([key, value]) => ({
      classroomId,
      appliesTo: "decision",
      ownerId: decision._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await VariableValue.insertMany(variableDocs);
    }
  }

  // Return decision with variables populated (auto-loaded via plugin)
  const createdSubmission = await this.findOne({
    classroomId,
    challengeId,
    userId,
  });
  if (createdSubmission) {
    await this.populateVariablesForMany([createdSubmission]);
  }
  return createdSubmission ? createdSubmission.toObject() : null;
};

/**
 * Update a decision
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @param {string} userId - Member ID
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated decision with variables populated
 */
submissionSchema.statics.updateSubmission = async function (
  classroomId,
  challengeId,
  userId,
  variables,
  organizationId,
  clerkUserId,
  updateOptions = {}
) {
  // Find existing decision
  const decision = await this.findOne({ classroomId, challengeId, userId });
  if (!decision) {
    throw new Error("Decision not found");
  }

  // Verify challenge is published and not closed
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }
  if (!challenge.isPublished) {
    throw new Error("Challenge is not published");
  }
  if (!Challenge.hasStarted(challenge)) {
    throw new Error("Challenge has not started yet");
  }
  if (challenge.isClosed) {
    throw new Error("Challenge is closed");
  }
  if (challenge.isLockedForStudents) {
    throw new Error("Submissions are closed for this challenge");
  }

  // Validate variables
  const validation = await this.validateSubmissionVariables(
    classroomId,
    variables,
    challengeId
  );
  if (!validation.isValid) {
    throw new Error(
      `Invalid decision variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    "decision",
    variables,
    { challengeId }
  );

  // Only persist variables with active definitions (exclude soft-deleted variables)
  const variablesToSave =
    await VariableDefinition.filterVariablesByActiveDefinitions(
      classroomId,
      "decision",
      variablesWithDefaults,
      { challengeId }
    );

  const configuredChallengeVariables = await challenge.getVariables();
  const existingChallengeVariableAnswers =
    decision.challengeVariableAnswers &&
    typeof decision.challengeVariableAnswers === "object" &&
    Object.keys(decision.challengeVariableAnswers).length > 0
      ? decision.challengeVariableAnswers
      : configuredChallengeVariables;
  const challengeVariableAnswers = await this.prepareChallengeVariableAnswers(
    classroomId,
    challengeId,
    updateOptions.challengeVariableAnswers ?? existingChallengeVariableAnswers
  );

  // Update decision document
  decision.challengeVariableAnswers = challengeVariableAnswers;
  decision.markModified("challengeVariableAnswers");
  decision.updatedBy = clerkUserId;
  decision.updatedDate = new Date();
  await decision.save();

  // Delete existing variable values
  await VariableValue.deleteMany({
    classroomId,
    appliesTo: "decision",
    ownerId: decision._id,
  });

  // Create new variable values if provided
  if (variablesToSave && Object.keys(variablesToSave).length > 0) {
    const variableEntries = Object.entries(variablesToSave);
    const variableDocs = variableEntries.map(([key, value]) => ({
      classroomId,
      appliesTo: "decision",
      ownerId: decision._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await VariableValue.insertMany(variableDocs);
    }
  }

  // Return decision with variables populated (auto-loaded via plugin)
  const updatedSubmission = await this.findOne({
    classroomId,
    challengeId,
    userId,
  });
  if (updatedSubmission) {
    await this.populateVariablesForMany([updatedSubmission]);
  }
  return updatedSubmission ? updatedSubmission.toObject() : null;
};


/**
* Get decisions for a challenge (normalized for AI)
* @param {string} challengeId - Challenge ID
* @returns {Promise<Array>} Array of normalized decision objects
*/
submissionSchema.statics.getSubmissionsByScenario = async function (
  challengeId
) {
  const decisions = await this.find({ challengeId })
    .populate({
      path: "userId",
      select: "_id clerkUserId firstName lastName maskedEmail",
    })
    .populate({
      path: "jobs",
      select: "_id status error attempts startedAt completedAt dryRun",
    })
    .populate({
      path: "ledgerEntryId",
      select: "_id metrics randomEvent summary",
    });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(decisions);

  // Variables are automatically included via plugin (already in array format with full definitions)
  return decisions.map((decision) => {
    const submissionObj = decision.toObject();
    // Ensure legacy decisions (created before generation metadata existed) still expose a method.
    const generation =
      submissionObj.generation && typeof submissionObj.generation === "object"
        ? {
          ...submissionObj.generation,
          method: submissionObj.generation.method || "MANUAL",
        }
        : { method: "MANUAL" };

    return {
      ...submissionObj,
      generation,
      member: decision.userId
        ? {
          _id: decision.userId._id,
          clerkUserId: decision.userId.clerkUserId,
          email: decision.userId.maskedEmail,
          firstName: decision.userId.firstName,
          lastName: decision.userId.lastName,
        }
        : null,
      variables: submissionObj.variables || [],
      submittedAt: submissionObj.submittedAt,
      jobs: submissionObj.jobs || [],
      processingStatus: submissionObj.processingStatus || "pending",
    };
  });
};

/**
* Get lightweight decision references for a challenge (for job creation/enqueue).
* This intentionally avoids populates + variable population (which are expensive and unnecessary here).
*
* @param {string} challengeId - Challenge ID
* @returns {Promise<Array<{_id: ObjectId, userId: ObjectId}>>}
*/
submissionSchema.statics.getSubmissionRefsByScenario = async function (
  challengeId
) {
  return await this.find({ challengeId }).select("_id userId").lean();
};

/**
 * Get lightweight decision references for a challenge (for job creation/enqueue).
 * This intentionally avoids populates + variable population (which are expensive and unnecessary here).
 *
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<Array<{_id: ObjectId, userId: ObjectId}>>}
 */
submissionSchema.statics.getSubmissionRefsByScenario = async function (
  challengeId
) {
  return await this.find({ challengeId }).select("_id userId").lean();
};

/**
 * Get missing decisions for a challenge
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<Array>} Array of user IDs who haven't submitted (only org:member role)
 */
submissionSchema.statics.getMissingSubmissions = async function (
  classroomId,
  challengeId
) {
  const Enrollment = require("../enrollment/enrollment.model");
  const Classroom = require("../classroom/classroom.model");

  // Get classroom to access organization
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    throw new Error("Class not found");
  }

  const organizationId = classroom.organization;

  // Get all enrolled students (members) and populate with organizationMemberships
  const enrollments = await Enrollment.findByClass(classroomId).populate({
    path: "userId",
    select: "organizationMemberships",
  });

  // Filter to only include members with org:member role in this organization
  const filteredEnrollments = enrollments.filter((enrollment) => {
    const member = enrollment.userId;
    if (!member || !member.organizationMemberships) {
      return false;
    }

    // Check if member has org:member role in this organization
    const orgMembership = member.organizationMemberships.find(
      (membership) =>
        membership.organizationId.toString() === organizationId.toString() &&
        membership.role === "org:member"
    );

    return !!orgMembership;
  });

  // Extract ObjectIds from enrolled users (userId is populated, so it's an object with _id)
  const enrolledUserIds = filteredEnrollments
    .map((e) => {
      const userId = e.userId;
      // userId is populated, so it's a document object - extract the _id
      // If _id exists, use it; otherwise userId itself should be the ObjectId
      if (!userId) return null;
      return userId._id ? userId._id : userId;
    })
    .filter(Boolean); // Remove any null values

  // Get all decisions for this challenge (use lean to avoid population issues)
  const decisions = await this.find({ challengeId }).lean();
  const submittedUserIds = new Set(decisions.map((s) => s.userId.toString()));

  // Find missing user IDs (convert to string for comparison)
  const missingUserIds = enrolledUserIds.filter((userId) => {
    const userIdStr = userId.toString();
    return !submittedUserIds.has(userIdStr);
  });

  return missingUserIds;
};

/**
 * Get decision for a user and challenge
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Decision with variables or null
 */
submissionSchema.statics.getSubmission = async function (
  classroomId,
  challengeId,
  userId
) {
  const decision = await this.findOne({
    classroomId,
    challengeId,
    userId,
  }).populate({
    path: "jobs",
    select:
      "_id status error attempts startedAt completedAt dryRun ledgerWriteMode recalculationRunId ledgerEntryId",
  });
  if (!decision) {
    return null;
  }

  // Explicitly populate variables before returning (post-init hook may not complete in time)
  await this.populateVariablesForMany([decision]);
  const submissionObj = decision.toObject();
  // Ensure legacy decisions (created before generation metadata existed) still expose a method.
  submissionObj.generation =
    submissionObj.generation && typeof submissionObj.generation === "object"
      ? {
        ...submissionObj.generation,
        method: submissionObj.generation.method || "MANUAL",
      }
      : { method: "MANUAL" };
  // Ensure _id is included (should be by default, but make it explicit)
  submissionObj._id = decision._id;
  submissionObj.jobs = submissionObj.jobs || [];
  submissionObj.processingStatus = submissionObj.processingStatus || "pending";
  return submissionObj;
};

/**
 * Get all decisions for a user
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Array>} Array of decisions with variables
 */
submissionSchema.statics.getSubmissionsByUser = async function (
  classroomId,
  userId
) {
  const decisions = await this.find({ classroomId, userId })
    .populate({
      path: "jobs",
      select: "_id status error attempts startedAt completedAt dryRun",
    })
    .sort({
      submittedAt: 1,
    });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(decisions);

  // Variables are automatically included via plugin
  return decisions.map((decision) => {
    const submissionObj = decision.toObject();
    // Ensure legacy decisions (created before generation metadata existed) still expose a method.
    submissionObj.generation =
      submissionObj.generation && typeof submissionObj.generation === "object"
        ? {
          ...submissionObj.generation,
          method: submissionObj.generation.method || "MANUAL",
        }
        : { method: "MANUAL" };
    submissionObj.jobs = submissionObj.jobs || [];
    submissionObj.processingStatus =
      submissionObj.processingStatus || "pending";
    return submissionObj;
  });
};

/**
 * Auto-create a Decision for every enrolled student in the class for a published challenge.
 * Uses one LLM call per profileType, then reuses the generated values for all students of that type.
 */
submissionSchema.statics.autoCreateDecisionsForChallenge = async function ({
  challengeId,
  organizationId,
  clerkUserId,
  options = {},
  punishAbsentStudents,
}) {
  const Enrollment = require("../enrollment/enrollment.model");
  const Profile = require("../profile/profile.model");
  const Member = require("../members/member.model");
  const ProfileType = require("../profileType/profileType.model");

  const {
    model = process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
    concurrency = 10,
    includeExisting = false,
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

  const studentIds = enrollments.map((e) => e.userId);
  const members = await Member.find({ _id: { $in: studentIds } })
    .select("_id clerkUserId")
    .lean();
  const clerkByMemberId = new Map(
    members.map((m) => [m._id.toString(), m.clerkUserId])
  );

  const profiles = await Profile.find({ classroomId, userId: { $in: studentIds } })
    .select("userId profileType")
    .lean();
  const storeByUserId = new Map(profiles.map((s) => [s.userId.toString(), s]));

  const studentsByStoreTypeId = new Map();
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
      clerkUserId: clerkByMemberId.get(uid) || clerkUserId,
    });
  }

  let absentPunishmentLevel = null;

  const generatedByStoreType = new Map();
  const storeTypeIds = Array.from(studentsByStoreTypeId.keys());
  const storeTypeDocs = await ProfileType.find({
    _id: { $in: storeTypeIds },
    organization: organizationId,
    isActive: true,
  });
  await Promise.all(storeTypeDocs.map((st) => st._loadVariables()));
  const storeTypeById = new Map(
    storeTypeDocs.map((st) => [st._id.toString(), st])
  );

  for (const [storeTypeId] of studentsByStoreTypeId) {
    const storeTypeDoc = storeTypeById.get(storeTypeId);
    if (!storeTypeDoc) {
      throw new Error(`ProfileType not found or inactive: ${storeTypeId}`);
    }
    const vars = await this.generateSubmissionVariablesForStoreType({
      classroomId,
      storeTypeKey: storeTypeDoc.key,
      storeTypeVariables: storeTypeDoc.variables || {},
      challenge: hydratedScenario,
      organizationId,
      clerkUserId,
      model,
      absentPunishmentLevel,
    });
    generatedByStoreType.set(storeTypeId, vars);
  }

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
      await this.createSubmission(
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
};

/**
 * Forward previous decisions for missing students in a challenge.
 */
submissionSchema.statics.forwardPreviousDecisionsForChallenge = async function ({
  challengeId,
  organizationId,
  clerkUserId,
  punishAbsentStudents,
}) {
  const Profile = require("../profile/profile.model");
  const ProfileType = require("../profileType/profileType.model");

  const challenge = await Challenge.findOne({
    _id: challengeId,
    organization: organizationId,
  });
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  if (!challenge.isPublished || challenge.isClosed) {
    return {
      skipped: true,
      reason: "Challenge not published or already closed",
      created: 0,
      existing: 0,
      missingPrevious: 0,
      errors: [],
    };
  }

  const classroomId = challenge.classroomId;

  const missingUserIds = await this.getMissingSubmissions(
    classroomId,
    challengeId
  );

  if (missingUserIds.length === 0) {
    return {
      skipped: false,
      created: 0,
      existing: 0,
      missingPrevious: 0,
      errors: [],
    };
  }

  const allScenarios = await Challenge.find({ classroomId })
    .sort({ week: 1 })
    .lean();

  const currentScenarioIndex = allScenarios.findIndex(
    (s) => s._id.toString() === challengeId.toString()
  );

  if (currentScenarioIndex === -1) {
    throw new Error("Current challenge not found in classroom challenges");
  }

  const previousScenarios = allScenarios.slice(0, currentScenarioIndex);
  const absentPunishmentLevel = normalizeAbsencePunishmentLevel(
    punishAbsentStudents
  );

  let created = 0;
  let existing = 0;
  let missingPrevious = 0;
  const errors = [];

  for (const userId of missingUserIds) {
    try {
      const existingSubmission = await this.findOne({
        classroomId,
        challengeId,
        userId,
      });

      if (existingSubmission) {
        existing += 1;
        continue;
      }

      let previousSubmission = null;

      for (let i = previousScenarios.length - 1; i >= 0; i--) {
        const prevScenario = previousScenarios[i];
        const decision = await this.getSubmission(
          classroomId,
          prevScenario._id,
          userId
        );

        if (decision && decision.variables) {
          previousSubmission = decision;
          break;
        }
      }

      if (!previousSubmission || !previousSubmission.variables) {
        try {
          const profile = await Profile.findOne({
            classroomId,
            userId,
          })
            .select("profileType")
            .lean();

          if (!profile) {
            missingPrevious += 1;
            errors.push({
              userId: userId.toString(),
              error:
                "No previous decision found and no profile found for AI fallback",
            });
            continue;
          }

          const storeTypeDoc = await ProfileType.findOne({
            _id: profile.profileType,
            organization: organizationId,
            isActive: true,
          });
          if (!storeTypeDoc) {
            missingPrevious += 1;
            errors.push({
              userId: userId.toString(),
              error:
                "No previous decision found and no profileType found for AI fallback",
            });
            continue;
          }
          await storeTypeDoc._loadVariables();

          const hydratedScenario = await Challenge.getScenarioById(
            challengeId,
            organizationId
          );

          const aiVars = await this.generateSubmissionVariablesForStoreType({
            classroomId,
            storeTypeKey: storeTypeDoc.key,
            storeTypeVariables: storeTypeDoc.variables || {},
            challenge: hydratedScenario,
            organizationId,
            clerkUserId,
            model: process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
            absentPunishmentLevel,
          });

          await this.createSubmission(
            classroomId,
            challengeId,
            userId,
            aiVars,
            organizationId,
            clerkUserId,
            {
              generation: {
                method: "AI_FALLBACK",
                meta: {
                  model: process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
                  absentPunishmentLevel,
                  reason: "NO_PREVIOUS_SUBMISSION",
                  note: "Forward-previous mode fell back to AI",
                },
              },
            }
          );

          created += 1;
          console.log(
            `Used AI fallback for user ${userId} (no previous decision)${absentPunishmentLevel
              ? ` with ${absentPunishmentLevel} absence punishment`
              : ""
            }`
          );
        } catch (fallbackError) {
          missingPrevious += 1;
          errors.push({
            userId: userId.toString(),
            error: `No previous decision found and AI fallback failed: ${fallbackError.message || String(fallbackError)
              }`,
          });
        }
        continue;
      }

      const previousVars = previousSubmission.variables;
      const varsObject = {};

      if (Array.isArray(previousVars)) {
        for (const varDef of previousVars) {
          if (varDef.key && varDef.value !== undefined) {
            varsObject[varDef.key] = varDef.value;
          }
        }
      } else if (typeof previousVars === "object" && previousVars !== null) {
        Object.assign(varsObject, previousVars);
      }

      const varsWithDefaults = await VariableDefinition.applyDefaults(
        classroomId,
        "decision",
        varsObject
      );

      const validation = await VariableDefinition.validateValues(
        classroomId,
        "decision",
        varsWithDefaults
      );

      if (!validation.isValid) {
        errors.push({
          userId: userId.toString(),
          error: `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
        });
        continue;
      }

      await this.createSubmission(
        classroomId,
        challengeId,
        userId,
        varsWithDefaults,
        organizationId,
        clerkUserId,
        {
          generation: {
            method: "FORWARDED_PREVIOUS",
            forwardedFromScenarioId: previousSubmission.challengeId || null,
            forwardedFromSubmissionId: previousSubmission._id || null,
            meta: {
              absentPunishmentLevel,
              note: "Auto-created on challenge outcome (FORWARD_PREVIOUS)",
            },
          },
        }
      );

      created += 1;
    } catch (error) {
      if (error.message && error.message.includes("already exists")) {
        existing += 1;
      } else {
        errors.push({
          userId: userId.toString(),
          error: error.message || String(error),
        });
      }
    }
  }

  return {
    skipped: false,
    created,
    existing,
    missingPrevious,
    errors,
  };
};

/**
 * Create decisions for missing students using variable definition defaults.
 */
submissionSchema.statics.useDefaultsForDecisions = async function ({
  challengeId,
  organizationId,
  clerkUserId,
  punishAbsentStudents,
}) {
  const Profile = require("../profile/profile.model");

  const challenge = await Challenge.findOne({
    _id: challengeId,
    organization: organizationId,
  });
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  if (!challenge.isPublished || challenge.isClosed) {
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
  const absentPunishmentLevel = normalizeAbsencePunishmentLevel(
    punishAbsentStudents
  );

  const missingUserIds = await this.getMissingSubmissions(
    classroomId,
    challengeId
  );

  if (missingUserIds.length === 0) {
    return {
      skipped: false,
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  const profiles = await Profile.find({
    classroomId,
    userId: { $in: missingUserIds },
  })
    .select("userId")
    .lean();

  const storeByUserId = new Map(profiles.map((s) => [s.userId.toString(), s]));

  let created = 0;
  let existing = 0;
  let missingStore = 0;
  const errors = [];

  for (const userId of missingUserIds) {
    try {
      const existingSubmission = await this.findOne({
        classroomId,
        challengeId,
        userId,
      });

      if (existingSubmission) {
        existing += 1;
        continue;
      }

      const userIdStr = userId.toString();
      if (!storeByUserId.has(userIdStr)) {
        missingStore += 1;
        errors.push({
          userId: userIdStr,
          error: "No profile found for user",
        });
        continue;
      }

      const varsWithDefaults = await VariableDefinition.applyDefaults(
        classroomId,
        "decision",
        {}
      );

      const validation = await VariableDefinition.validateValues(
        classroomId,
        "decision",
        varsWithDefaults
      );

      if (!validation.isValid) {
        errors.push({
          userId: userIdStr,
          error: `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
        });
        continue;
      }

      await this.createSubmission(
        classroomId,
        challengeId,
        userId,
        varsWithDefaults,
        organizationId,
        clerkUserId,
        {
          generation: {
            method: "DEFAULTS",
            meta: {
              absentPunishmentLevel,
              note: "Auto-created on challenge outcome (USE_DEFAULTS)",
            },
          },
        }
      );

      created += 1;
    } catch (error) {
      console.error("Error creating decision with defaults:", error);
      if (error.message && error.message.includes("already exists")) {
        existing += 1;
      } else {
        errors.push({
          userId: userId.toString(),
          error: error.message || String(error),
        });
      }
    }
  }

  return {
    skipped: false,
    created,
    existing,
    missingStore,
    errors,
  };
};

/**
 * Generate a fully-filled decision variables object for a given profileType + challenge.
 * Uses a cheap OpenAI model with structured JSON schema output.
 */
submissionSchema.statics.generateSubmissionVariablesForStoreType = async function ({
  classroomId,
  storeTypeKey,
  storeTypeVariables,
  challenge,
  organizationId,
  clerkUserId,
  model,
  absentPunishmentLevel,
}) {
  const openai = require("../../lib/openai");
  const VariableDefinition = require("../variableDefinition/variableDefinition.model");

  const definitions = await VariableDefinition.getDefinitionsForScope(
    classroomId,
    "decision"
  );

  if (!definitions || definitions.length === 0) {
    throw new Error("No decision variable definitions found for classroom");
  }

  const jsonSchema = buildJsonSchemaFromDefinitions(definitions);

  const promptPayload = {
    profileType: storeTypeKey,
    storeTypeVariables: storeTypeVariables
      ? {
        startingBalance: storeTypeVariables.startingBalance,
        startingInventory: storeTypeVariables.startingInventory,
        maxDailyCapacity: storeTypeVariables.maxDailyCapacity,
        weeklyRent: storeTypeVariables.weeklyRent,
        fulfillmentModel: storeTypeVariables.fulfillmentModel,
      }
      : null,
    challenge: challenge
      ? {
        title: challenge.title,
        week: challenge.week,
        variables: challenge.variables || {},
      }
      : null,
    submissionVariablesToFill: definitions.map((d) => ({
      key: d.key,
      dataType: d.dataType,
      min: d.min,
      max: d.max,
      options:
        d.dataType === "select" ? normalizeSelectAllowedValues(d) : undefined,
      description: d.description || d.label || "",
    })),
    ...(absentPunishmentLevel && {
      studentWasAbsent: true,
      absencePunishmentLevel: absentPunishmentLevel,
    }),
  };

  let systemMessages = [
    "You generate realistic, conservative weekly student decisions (decision variables) for a SCALE LXP learning simulation.",
    "Return ONLY JSON that matches the provided schema.",
    "Values must be plausible and within min/max constraints and enums.",
  ];

  if (absentPunishmentLevel) {
    const punishmentGuidance = {
      high: "The student was absent; simulate severe mismanagement. Generate decisions that reliably lead to large stockouts AND/or large waste/spoilage, plus service failures. Examples: staffing at/near the minimum, production plan badly mismatched to expected demand (either too low causing stockouts or too high causing spoilage), reorders far too low for key ingredients, late/forgotten replenishment, poor inventory planning choices. Make the overall set of decisions clearly worse than a typical week.",
      medium:
        "The student was absent; simulate noticeable mismanagement. Generate decisions that tend to cause below-average outcomes: slightly insufficient staffing, reorders that are too low or poorly timed, and a production plan that modestly misses demand. Include at least one clear operational mistake (e.g., under-ordering, not scaling staffing with demand, overproducing perishables).",
      low: "The student was absent; simulate mild mismanagement. Generate decisions that are still plausible but slightly worse than average: a bit understaffed, slightly conservative/low reorders, and a production plan that leaves some demand unmet or causes some waste.",
    };

    systemMessages.push(
      `IMPORTANT: The student was ABSENT for this challenge. ${punishmentGuidance[absentPunishmentLevel] || punishmentGuidance.medium}`
    );
  }

  const system = systemMessages.join("\n");

  const response = await openai.chat.completions.create({
    model: model || process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 600,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          "Generate decision variable values for ONE student based on the following context:\n" +
          JSON.stringify(promptPayload, null, 2),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "submission_variables",
        schema: jsonSchema,
      },
    },
  });

  const content = response.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse OpenAI decision JSON: ${e.message}`);
  }

  const coerced = {};
  for (const def of definitions) {
    coerced[def.key] = clampNumber(def, coerceValue(def, parsed[def.key]));
  }

  const filled = fillMissingWithDefaults(definitions, coerced);

  const validation = await VariableDefinition.validateValues(
    classroomId,
    "decision",
    filled
  );
  if (!validation.isValid) {
    throw new Error(
      `Auto-decision generation failed validation: ${validation.errors
        .map((e) => e.message)
        .join(", ")}`
    );
  }

  return filled;
};

// Instance methods

/**
 * Populate variables for this decision instance
 * Loads and caches variables so they're available in toObject()/toJSON()
 * @returns {Promise<this>} This decision instance with variables populated
 */
submissionSchema.methods.populateVariables = async function () {
  // Load variables (will be cached by the plugin)
  await this._loadVariables();
  return this;
};

/**
 * Get variables for this decision instance
 * Uses cached variables if available, otherwise loads them
 * @returns {Promise<Object>} Variables object
 */
submissionSchema.methods.getVariables = async function () {
  // Use plugin's cached variables or load them
  return await this._loadVariables();
};

/**
 * Check if decision can be edited
 * @returns {boolean} Always false - decisions are immutable
 */
submissionSchema.methods.canEdit = function () {
  return false; // Decisions are immutable after creation
};

/**
 * Add a job to this decision
 * @param {string} jobId - Job ID to add
 * @returns {Promise<this>} Updated decision
 */
submissionSchema.methods.addJob = async function (jobId) {
  if (!this.jobs.includes(jobId)) {
    this.jobs.push(jobId);
    // Set status to processing if not already completed
    if (this.processingStatus === "pending") {
      this.processingStatus = "processing";
    }
    await this.save();
  }
  return this;
};

/**
 * Update processing status based on job status
 * @param {string} jobStatus - Job status ("completed" or "failed")
 * @returns {Promise<this>} Updated decision
 */
submissionSchema.methods.updateProcessingStatus = async function (jobStatus) {
  if (jobStatus === "completed") {
    this.processingStatus = "completed";
  } else if (jobStatus === "failed") {
    // Only set to failed if not already completed (in case of retries)
    if (this.processingStatus !== "completed") {
      this.processingStatus = "failed";
    }
  }
  await this.save();
  return this;
};

const Decision = mongoose.model("Decision", submissionSchema);

module.exports = Decision;
