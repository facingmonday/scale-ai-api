const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");
// Note: Classroom, Enrollment, and Member are required inside functions to avoid circular dependencies
/**
 * @openapi
 * components:
 *   schemas:
 *     Challenge:
 *       type: object
 *       required:
 *         - classroomId
 *         - title
 *       properties:
 *         _id:
 *           type: string
 *         classroomId:
 *           type: string
 *           description: The classroom ID.
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         isPublished:
 *           type: boolean
 *         isClosed:
 *           type: boolean
 *         simulationMode:
 *           type: string
 *           enum: [direct, batch]
 *           description: New challenges default to direct; legacy challenges retain batch.
 *         simulationConcurrency:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         publishAt:
 *           type: string
 *           format: date-time
 *         publishMode:
 *           type: string
 *           enum: [MANUAL, SCHEDULED]
 *           default: MANUAL
 *           description: Controls initial challenge opening independently of post-opening automation.
 *         submissionDeadlineAt:
 *           type: string
 *           format: date-time
 *         closeSubmissionsAt:
 *           type: string
 *           format: date-time
 *         processAt:
 *           type: string
 *           format: date-time
 *         feedbackReleaseAt:
 *           type: string
 *           format: date-time
 *         feedbackReleaseMode:
 *           type: string
 *           enum: [IMMEDIATE, DELAYED, MANUAL]
 *         isFeedbackReleased:
 *           type: boolean
 *         isLockedForStudents:
 *           type: boolean
 *         lifecycleStatus:
 *           type: string
 *           enum: [Draft, Scheduled, Open, Locked, Closed]
 *           description: Derived from the configured start and publish/lock/close flags
 *         allowLateSubmissions:
 *           type: boolean
 *         lateSubmissionPolicy:
 *           type: object
 *           properties:
 *             penaltyPercentPerDay:
 *               type: number
 *         automationMode:
 *           type: string
 *           enum: [MANUAL, FULL]
 *           description: Controls deadline, result-processing, and feedback automation after opening.
 *         automationStatus:
 *           type: string
 *           enum: [UNSCHEDULED, SCHEDULED, PUBLISHED, PROCESSING, COMPLETED, BLOCKED, FAILED, DRAFT, acceptingSubmissions, submissionsClosed, queuedForProcessing, processed, feedbackReleased]
 *         automationError:
 *           type: string
 *         automationLastCheckedAt:
 *           type: string
 *           format: date-time
 *         automatedProcessedAt:
 *           type: string
 *           format: date-time
 *         missingSubmissionPolicy:
 *           type: string
 *           enum: [FORWARD_PREVIOUS, USE_DEFAULTS, SKIP]
 *         punishAbsentStudents:
 *           type: string
 *           enum: [high, medium, low, none]
 *         week:
 *           type: number
 *         imageUrl:
 *           type: string
 *         variables:
 *           type: object
 *           description: Map of resolved challenge variables.
 */
const scenarioSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  simulationMode: {
    type: String,
    enum: ["direct", "batch"],
    default: function () {
      return this.isNew ? "direct" : "batch";
    },
  },
  simulationConcurrency: {
    type: Number,
    default: 5,
    min: 1,
    max: 20,
    validate: Number.isInteger,
  },
  processingRun: {
    id: String,
    mode: { type: String, enum: ["direct", "batch"] },
    concurrency: Number,
    preparing: { type: Boolean, default: false },
    resetPending: { type: Boolean, default: false },
  },
  suppressNotifications: {
    type: Boolean,
    default: false,
  },
  isClosed: {
    type: Boolean,
    default: false,
  },
  publishAt: {
    type: Date,
    default: null,
  },
  publishMode: {
    type: String,
    enum: ["MANUAL", "SCHEDULED"],
    default: function () {
      return this.publishAt ? "SCHEDULED" : "MANUAL";
    },
  },
  submissionDeadlineAt: {
    type: Date,
    default: null,
  },
  closeSubmissionsAt: {
    type: Date,
    default: null,
  },
  processAt: {
    type: Date,
    default: null,
  },
  feedbackReleaseAt: {
    type: Date,
    default: null,
  },
  feedbackReleaseMode: {
    type: String,
    enum: ["IMMEDIATE", "DELAYED", "MANUAL"],
    default: "IMMEDIATE",
  },
  isFeedbackReleased: {
    type: Boolean,
    default: false,
  },
  isLockedForStudents: {
    type: Boolean,
    default: false,
  },
  allowLateSubmissions: {
    type: Boolean,
    default: false,
  },
  lateSubmissionPolicy: {
    penaltyPercentPerDay: {
      type: Number,
      default: 0,
    },
  },
  automationMode: {
    type: String,
    enum: ["MANUAL", "FULL"],
    default: "FULL",
  },
  automationStatus: {
    type: String,
    enum: [
      "UNSCHEDULED",
      "SCHEDULED",
      "PUBLISHED",
      "PROCESSING",
      "COMPLETED",
      "BLOCKED",
      "FAILED",
      "DRAFT",
      "acceptingSubmissions",
      "submissionsClosed",
      "queuedForProcessing",
      "processing",
      "processed",
      "feedbackReleased",
    ],
    default: "UNSCHEDULED",
  },
  automationError: {
    type: String,
    default: null,
  },
  automationLastCheckedAt: {
    type: Date,
    default: null,
  },
  automatedProcessedAt: {
    type: Date,
    default: null,
  },
  teacherDebrief: {
    type: new mongoose.Schema(
      {
        summary: { type: String, default: "" },
        strongerPatterns: { type: [String], default: [] },
        weakerPatterns: { type: [String], default: [] },
        expectedVariation: { type: [String], default: [] },
        suspiciousAnomalies: { type: [String], default: [] },
        commonMistakes: { type: [String], default: [] },
        discussionQuestions: { type: [String], default: [] },
        suggestedInterventions: { type: [String], default: [] },
        profileTypeSummaries: {
          type: [
            new mongoose.Schema(
              {
                key: { type: String, default: "" },
                label: { type: String, required: true },
                participantCount: { type: Number, default: 0, min: 0 },
                summary: { type: String, default: "" },
                strengths: { type: [String], default: [] },
                risks: { type: [String], default: [] },
                recommendedFocus: { type: [String], default: [] },
              },
              { _id: false },
            ),
          ],
          default: [],
        },
        status: {
          type: String,
          enum: ["pending", "processing", "completed", "failed"],
          default: "pending",
        },
        generatedAt: { type: Date, default: null },
        attempts: { type: Number, default: 0, min: 0 },
        error: { type: String, default: null },
      },
      { _id: false },
    ),
    default: undefined,
    select: false,
  },
  missingSubmissionPolicy: {
    type: String,
    enum: ["FORWARD_PREVIOUS", "USE_DEFAULTS", "SKIP"],
    default: "SKIP",
  },
  punishAbsentStudents: {
    type: String,
    enum: ["high", "medium", "low", "none"],
    default: "none",
  },
  week: {
    type: Number,
    default: 0,
  },
  imageUrl: {
    type: String,
    required: false,
  },
}).add(baseSchema);

// Apply variable population plugin
scenarioSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "challenge",
  outputFormat: "valueMap",
});

// Compound indexes for performance
scenarioSchema.index({ classroomId: 1, week: 1 });
scenarioSchema.index({ classroomId: 1, isPublished: 1, isClosed: 1 });
scenarioSchema.index({ classroomId: 1, createdDate: -1 });
scenarioSchema.index({ organization: 1, classroomId: 1 });
scenarioSchema.index({ isPublished: 1, isClosed: 1, publishAt: 1 });
scenarioSchema.index({ publishMode: 1, isPublished: 1, publishAt: 1 });
scenarioSchema.index({ isPublished: 1, isClosed: 1, submissionDeadlineAt: 1 });
scenarioSchema.index({ automationMode: 1, automationStatus: 1 });

function serializeChallenge(doc, ret) {
  ret.publishMode = doc.constructor.getPublishMode(doc);
  return ret;
}

scenarioSchema.set("toJSON", { virtuals: true, transform: serializeChallenge });
scenarioSchema.set("toObject", {
  virtuals: true,
  transform: serializeChallenge,
});

/**
 * Determine whether a challenge's configured start instant has arrived.
 * Challenges without a start date are eligible to start immediately.
 * @param {{ publishAt?: Date|string|null }} challenge
 * @param {Date} [now]
 * @returns {boolean}
 */
scenarioSchema.statics.hasStarted = function (challenge, now = new Date()) {
  if (!challenge?.publishAt) return true;
  const publishAt = new Date(challenge.publishAt).getTime();
  if (Number.isNaN(publishAt)) return false;
  return publishAt <= now.getTime();
};

/**
 * Determine whether students may see a challenge.
 * @param {{ isPublished?: boolean, publishAt?: Date|string|null }} challenge
 * @param {Date} [now]
 * @returns {boolean}
 */
scenarioSchema.statics.isVisibleToStudents = function (
  challenge,
  now = new Date(),
) {
  return !!challenge?.isPublished && this.hasStarted(challenge, now);
};

/**
 * Resolve the opening method for both current and legacy challenges.
 * Legacy documents with a start date were scheduled; those without one were
 * opened manually.
 * @param {{ publishMode?: string, publishAt?: Date|string|null }} challenge
 * @returns {"MANUAL"|"SCHEDULED"}
 */
scenarioSchema.statics.getPublishMode = function (challenge) {
  if (challenge?.publishMode === "SCHEDULED") return "SCHEDULED";
  if (challenge?.publishMode === "MANUAL") return "MANUAL";
  return challenge?.publishAt ? "SCHEDULED" : "MANUAL";
};

/**
 * Derive lifecycle status from the schedule and publish/lock/close flags.
 * @param {{ isPublished?: boolean, isLockedForStudents?: boolean, isClosed?: boolean, publishAt?: Date|string|null, publishMode?: string }} challenge
 * @param {Date} [now]
 * @returns {"Draft"|"Scheduled"|"Open"|"Locked"|"Closed"}
 */
scenarioSchema.statics.getLifecycleStatus = function (
  challenge,
  now = new Date(),
) {
  if (!challenge) return "Draft";
  if (challenge.isClosed) return "Closed";
  const hasScheduledStart =
    this.getPublishMode(challenge) === "SCHEDULED" && !!challenge.publishAt;
  const waitingForPublishWorker = hasScheduledStart && !challenge.isPublished;
  if (
    hasScheduledStart &&
    (!this.hasStarted(challenge, now) || waitingForPublishWorker)
  ) {
    return "Scheduled";
  }
  if (!challenge.isPublished) return "Draft";
  if (challenge.isLockedForStudents) return "Locked";
  return "Open";
};

scenarioSchema.virtual("lifecycleStatus").get(function () {
  return this.constructor.getLifecycleStatus(this);
});

// Static methods - Shared utilities for challenge operations

/**
 * Get next week number for a class
 * @param {string} classroomId - Class ID
 * @returns {Promise<number>} Next week number
 */
scenarioSchema.statics.getNextWeekNumber = async function (classroomId) {
  let week = 0;
  const lastScenario = await this.findOne({ classroomId })
    .sort({ week: -1 })
    .limit(1)
    .lean();

  if (!lastScenario || !lastScenario.week) {
    week = 1;
  } else {
    week = parseInt(lastScenario.week) + 1;
  }

  return week;
};

/**
 * Validate challenge variables against VariableDefinition
 * @param {string} classroomId - Class ID
 * @param {Object} variables - Variables object to validate
 * @param {string} [challengeId] - Challenge ID (optional)
 * @returns {Promise<Object>} Validation result
 */
scenarioSchema.statics.validateScenarioVariables = async function (
  classroomId,
  variables,
  challengeId = null,
) {
  return await VariableDefinition.validateValues(
    classroomId,
    "challenge",
    variables,
    { challengeId },
  );
};

/**
 * Create a challenge
 * @param {string} classroomId - Class ID
 * @param {Object} scenarioData - Challenge data (title, description, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created challenge with variables populated
 */
scenarioSchema.statics.createScenario = async function (
  classroomId,
  scenarioData,
  organizationId,
  clerkUserId,
) {
  // Get next week number
  const week = await this.getNextWeekNumber(classroomId);
  // Extract variables and imageUrl from scenarioData
  const {
    variables,
    imageUrl,
    publishAt,
    publishMode,
    submissionDeadlineAt,
    closeSubmissionsAt,
    processAt,
    feedbackReleaseAt,
    feedbackReleaseMode,
    allowLateSubmissions,
    lateSubmissionPolicy,
    automationMode,
    automationStatus,
    missingSubmissionPolicy,
    punishAbsentStudents,
    simulationMode,
    simulationConcurrency,
    ...scenarioFields
  } = scenarioData;

  const resolvedAutomationMode = automationMode || "FULL";
  const resolvedPublishMode =
    publishMode || (publishAt ? "SCHEDULED" : "MANUAL");
  if (resolvedPublishMode === "SCHEDULED" && !publishAt) {
    throw new Error("publishAt is required for scheduled opening");
  }
  const resolvedPublishAt = resolvedPublishMode === "MANUAL" ? null : publishAt;
  const resolvedFeedbackReleaseMode =
    resolvedAutomationMode === "MANUAL" && feedbackReleaseMode === "DELAYED"
      ? "MANUAL"
      : feedbackReleaseMode || "IMMEDIATE";

  const scheduleFields = {
    publishAt: resolvedPublishAt || null,
    publishMode: resolvedPublishMode,
    submissionDeadlineAt: submissionDeadlineAt || null,
    closeSubmissionsAt: closeSubmissionsAt || submissionDeadlineAt || null,
    processAt: processAt || submissionDeadlineAt || null,
    feedbackReleaseAt: feedbackReleaseAt || null,
    feedbackReleaseMode: resolvedFeedbackReleaseMode,
    allowLateSubmissions: allowLateSubmissions || false,
    lateSubmissionPolicy: lateSubmissionPolicy || { penaltyPercentPerDay: 0 },
    automationMode: resolvedAutomationMode,
    automationStatus:
      automationStatus ||
      (resolvedPublishMode === "SCHEDULED" ? "SCHEDULED" : "UNSCHEDULED"),
    missingSubmissionPolicy: missingSubmissionPolicy || "SKIP",
    punishAbsentStudents: punishAbsentStudents || "none",
    simulationMode: simulationMode || "direct",
    simulationConcurrency: simulationConcurrency ?? 5,
  };

  // Validate variables if provided
  if (variables && Object.keys(variables).length > 0) {
    const validation = await this.validateScenarioVariables(
      classroomId,
      variables,
    );

    if (!validation.isValid) {
      throw new Error(
        `Invalid challenge variables: ${validation.errors.map((e) => e.message).join(", ")}`,
      );
    }

    // Apply defaults
    const variablesWithDefaults = await VariableDefinition.applyDefaults(
      classroomId,
      "challenge",
      variables,
    );

    // Create challenge document
    const challenge = new this({
      classroomId,
      week,
      title: scenarioFields.title,
      description: scenarioFields.description || "",
      imageUrl: imageUrl || null,
      isPublished: false,
      isClosed: false,
      ...scheduleFields,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await challenge.save();

    // Create variable values if provided
    const variableEntries = Object.entries(variablesWithDefaults);
    const variableDocs = variableEntries.map(([key, value]) => ({
      classroomId,
      appliesTo: "challenge",
      ownerId: challenge._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await VariableValue.insertMany(variableDocs);
    }

    // Return challenge with variables populated (auto-loaded via plugin)
    const createdScenario = await this.findById(challenge._id);
    return createdScenario ? createdScenario.toObject() : null;
  }

  // No variables provided
  const challenge = new this({
    classroomId,
    week,
    title: scenarioFields.title,
    description: scenarioFields.description || "",
    imageUrl: imageUrl || null,
    isPublished: false,
    isClosed: false,
    ...scheduleFields,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await challenge.save();
  // Variables are automatically included via plugin
  return challenge.toObject();
};

/**
 * Get active challenge (published and not closed)
 * @param {string} classroomId - Class ID
 * @returns {Promise<Object|null>} Active challenge with variables or null
 */
scenarioSchema.statics.getActiveScenario = async function (classroomId) {
  const now = new Date();
  const challenge = await this.findOne({
    classroomId,
    isPublished: true,
    isClosed: false,
    $or: [
      { publishMode: "MANUAL" },
      { publishAt: null },
      { publishAt: { $lte: now } },
    ],
  }).sort({ week: -1 });

  if (!challenge) {
    return null;
  }

  await challenge._loadVariables();

  // Variables are automatically included via plugin's post-init hook
  return challenge.toObject();
};

/**
 * Get all challenges for a class
 * @param {string} classroomId - Class ID
 * @param {Object} options - Options (includeClosed)
 * @returns {Promise<Array>} Array of challenges with variables
 */
scenarioSchema.statics.getScenariosByClass = async function (
  classroomId,
  options = {},
) {
  const query = { classroomId };
  if (!options.includeClosed) {
    query.isClosed = false;
  }

  const challenges = await this.find(query).sort({ week: 1 });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(challenges);

  // Variables are automatically included via plugin
  return challenges.map((challenge) => challenge.toObject());
};

/**
 * Get challenge by ID with class validation
 * @param {string} challengeId - Challenge ID
 * @param {string} organizationId - Organization ID (optional, for validation)
 * @param {Object} options - Detail fields to include
 * @returns {Promise<Object|null>} Challenge with variables or null
 */
scenarioSchema.statics.getScenarioById = async function (
  challengeId,
  organizationId = null,
  options = {},
) {
  const query = { _id: challengeId };
  if (organizationId) {
    query.organization = organizationId;
  }

  let challengeQuery = this.findOne(query);
  if (options.includeTeacherDebrief) {
    challengeQuery = challengeQuery.select("+teacherDebrief");
  }
  const challenge = await challengeQuery;
  if (!challenge) {
    return null;
  }

  // Explicitly load variables to ensure they're cached (post-init hook is async and may not have completed)
  await challenge._loadVariables();

  // Variables are automatically included via plugin's toObject() override
  return challenge.toObject();
};

// Instance methods

/**
 * Get variables for this challenge instance
 * Uses cached variables if available, otherwise loads them
 * @returns {Promise<Object>} Variables object
 */
scenarioSchema.methods.getVariables = async function () {
  // Use plugin's cached variables or load them
  return await this._loadVariables();
};

/**
 * Update variables for this challenge
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} Updated variables object
 */
scenarioSchema.methods.updateVariables = async function (
  variables,
  organizationId,
  clerkUserId,
) {
  // Validate variables
  const validation = await this.constructor.validateScenarioVariables(
    this.classroomId,
    variables,
    this._id,
  );

  if (!validation.isValid) {
    throw new Error(
      `Invalid challenge variables: ${validation.errors.map((e) => e.message).join(", ")}`,
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    this.classroomId,
    "challenge",
    variables,
    { challengeId: this._id },
  );

  // Update or create variable values
  const variableEntries = Object.entries(variablesWithDefaults);
  for (const [key, value] of variableEntries) {
    await VariableValue.setVariable(
      this.classroomId,
      "challenge",
      this._id,
      key,
      value,
      organizationId,
      clerkUserId,
    );
  }

  // Delete variables that are not in the new set
  const existingVariables = await VariableValue.find({
    classroomId: this.classroomId,
    appliesTo: "challenge",
    ownerId: this._id,
  });
  const newKeys = new Set(Object.keys(variablesWithDefaults));
  for (const existingVar of existingVariables) {
    if (!newKeys.has(existingVar.variableKey)) {
      await VariableValue.deleteOne({ _id: existingVar._id });
    }
  }

  // Reload variables to update cache
  await this._loadVariables();

  return variablesWithDefaults;
};

/**
 * Publish this challenge
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated challenge
 */
scenarioSchema.methods.publish = async function (clerkUserId) {
  const publishMode = this.constructor.getPublishMode(this);
  if (publishMode === "SCHEDULED" && !this.publishAt) {
    throw new Error("publishAt is required for scheduled opening");
  }
  if (publishMode === "SCHEDULED" && !this.constructor.hasStarted(this)) {
    this.isPublished = false;
    this.publishMode = "SCHEDULED";
    this.automationStatus = "SCHEDULED";
    this.automationError = null;
    this.updatedBy = clerkUserId;
    await this.save();
    return this;
  }

  if (publishMode === "MANUAL") {
    this.publishMode = "MANUAL";
    this.publishAt = null;
  }

  // Check if there's already an active published challenge
  const activeScenario = await this.constructor.getActiveScenario(
    this.classroomId,
  );
  if (activeScenario && activeScenario._id.toString() !== this._id.toString()) {
    throw new Error("Another challenge is already published and active");
  }

  this.isPublished = true;
  this.automationStatus = "acceptingSubmissions";
  this.automationError = null;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Unpublish this challenge
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated challenge
 */
scenarioSchema.methods.unpublish = async function (clerkUserId) {
  this.isPublished = false;
  this.isLockedForStudents = false;
  this.publishMode = "MANUAL";
  this.publishAt = null;
  this.automationStatus = "UNSCHEDULED";
  this.automationError = null;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Close submissions and begin calculating results.
 * Result completion is recorded separately after every simulation job is
 * terminal so a closed challenge is not presented as completed too early.
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated challenge
 */
scenarioSchema.methods.beginResultCalculation = async function (clerkUserId) {
  this.isClosed = true;
  this.isLockedForStudents = true;
  this.isFeedbackReleased = false;
  this.automatedProcessedAt = null;
  this.automationStatus = "processing";
  this.automationError = null;
  this.automationLastCheckedAt = new Date();
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Mark result calculation complete after all simulation jobs are terminal.
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated challenge
 */
scenarioSchema.methods.completeResultCalculation = async function (
  clerkUserId,
) {
  const completedAt = this.automatedProcessedAt || new Date();
  this.isClosed = true;
  this.isLockedForStudents = true;
  this.automatedProcessedAt = completedAt;
  this.automationError = null;
  this.automationLastCheckedAt = completedAt;
  if (this.feedbackReleaseMode === "IMMEDIATE") {
    this.isFeedbackReleased = true;
    this.automationStatus = "feedbackReleased";
  } else {
    this.isFeedbackReleased = false;
    this.automationStatus = "processed";
  }
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Backwards-compatible close transition. Closing now starts calculation;
 * callers must rely on ledger completion reconciliation for completion.
 */
scenarioSchema.methods.close = async function (clerkUserId) {
  return this.beginResultCalculation(clerkUserId);
};

/**
 * Open (re-open) this challenge
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated challenge
 */
scenarioSchema.methods.open = async function (clerkUserId) {
  this.isClosed = false;
  this.isLockedForStudents = false;
  this.isFeedbackReleased = false;
  this.automationStatus = this.isPublished
    ? "acceptingSubmissions"
    : "UNSCHEDULED";
  this.automatedProcessedAt = null;
  this.automationError = null;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Check if challenge can be edited
 * @returns {boolean} True if can be edited
 */
scenarioSchema.methods.canEdit = function () {
  // Can edit if not published or not closed
  return !this.isPublished || !this.isClosed;
};

/**
 * Check if challenge can be published
 * @returns {Promise<boolean>} True if can be published
 */
scenarioSchema.methods.canPublish = async function () {
  // Can publish if not already published and not closed
  if (this.isPublished || this.isClosed) {
    return false;
  }

  // Check if another challenge is active
  const activeScenario = await this.constructor.getActiveScenario(
    this.classroomId,
  );
  return (
    !activeScenario || activeScenario._id.toString() === this._id.toString()
  );
};

scenarioSchema.pre("validate", function (next) {
  if (!this.publishMode) {
    this.publishMode = this.constructor.getPublishMode(this);
  }
  if (this.publishMode === "MANUAL") {
    this.publishAt = null;
  } else if (!this.publishAt) {
    this.invalidate("publishAt", "publishAt is required for scheduled opening");
  }
  if (
    this.automationMode === "MANUAL" &&
    this.feedbackReleaseMode === "DELAYED"
  ) {
    this.feedbackReleaseMode = "MANUAL";
  }
  next();
});

// Track creation state for post-save hooks
scenarioSchema.pre("save", function (next) {
  this._wasNew = this.isNew;
  // Track if isPublished is being changed from false to true
  if (!this.isNew && this.isModified("isPublished") && this.isPublished) {
    this._isPublishedJustSet = true;
  } else if (this.isNew && this.isPublished) {
    this._isPublishedJustSet = true;
  } else {
    this._isPublishedJustSet = false;
  }
  // Track if isClosed is being modified (to skip published email check when closing)
  this._isClosedJustSet =
    !this.isNew && this.isModified("isClosed") && this.isClosed;
  next();
});

// Post-save hook to send emails when challenge is published
// Note: This checks for the "challenge-created" (published) email, NOT the "challenge-closed" (results) email
// Results emails are sent from the ledger model when ledger entries are created
scenarioSchema.post("save", async function (doc, next) {
  try {
    // Skip published email check if challenge is being closed (results email will be sent when ledger entries are created)
    if (doc._isClosedJustSet) {
      return next();
    }

    // Only check for published email if challenge is published
    if (doc.isPublished) {
      // Double-check: fetch the document to see if notifications were already sent
      // This prevents duplicate notifications on document updates
      const Notification = require("../notifications/notifications.model");
      const existingNotification = await Notification.findOne({
        "modelData.challenge": doc._id,
        templateSlug: "challenge-created",
        type: "email",
      }).lean();

      // Send email if:
      // 1. isPublished was just set to true (new publish), OR
      // 2. Challenge is published but no notification exists (handles cases where email wasn't sent initially)
      const shouldSendEmail =
        doc._isPublishedJustSet || (!existingNotification && doc.isPublished);

      if (shouldSendEmail) {
        await queueScenarioPublishedEmails(doc);
      }
    }
    return next();
  } catch (error) {
    console.error("Error queueing challenge published emails:", error);
    return next();
  }
});

async function queueScenarioPublishedEmails(challenge) {
  const Classroom = require("../classroom/classroom.model");
  const Enrollment = require("../enrollment/enrollment.model");
  const Notification = require("../notifications/notifications.model");

  // Abort as early as possible: if SEND_EMAIL isn't enabled, don't create Notification
  // records (which would otherwise enqueue email jobs via Notification post-save hook).
  if (process.env.SEND_EMAIL !== "true") {
    console.log(
      "SEND_EMAIL is not set to 'true'; skipping challenge published notification creation",
    );
    return;
  }

  const classroomId = challenge.classroomId;
  const organizationId = challenge.organization;

  if (!classroomId) {
    console.warn("No classroomId on challenge, skipping notification emails");
    return;
  }

  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    console.error("Classroom not found for challenge email notification");
    return;
  }

  // Get all enrolled students (members only) - explicitly exclude admins
  const memberEnrollments = await Enrollment.findByClassAndRole(
    classroomId,
    "member",
  );

  if (memberEnrollments.length === 0) {
    return;
  }

  const host = process.env.SCALE_ADMIN_HOST || "https://localhost:5173";
  const scenarioLink = `${host}/class/${classroomId}/challenge/${challenge._id}`;

  // Get the clerkUserId from the challenge (updatedBy is set when published)
  // The challenge should be a Mongoose document with updatedBy set from the publish() call
  let clerkUserId = challenge.updatedBy || challenge.createdBy;

  // If challenge is a plain object (from toObject()), try to get updatedBy from it
  // Otherwise, if we have an ID, fetch the document
  if (!clerkUserId && challenge._id) {
    const ScenarioModel = require("./challenge.model");
    const scenarioDoc = await ScenarioModel.findById(challenge._id).select(
      "updatedBy createdBy",
    );
    if (scenarioDoc) {
      clerkUserId = scenarioDoc.updatedBy || scenarioDoc.createdBy;
    }
  }

  // Fallback to a system user if we still don't have a clerkUserId
  if (!clerkUserId) {
    clerkUserId = "system";
    console.warn(
      "No clerkUserId found on challenge, using 'system' for notification createdBy/updatedBy",
    );
  }

  // Create notifications for all enrolled students
  const notifications = await Promise.allSettled(
    memberEnrollments.map(async (enrollment) => {
      try {
        const notification = await Notification.create({
          type: "email",
          recipient: {
            id: enrollment.userId,
            type: "Member",
            ref: "Member",
          },
          title: `New Challenge Published: ${challenge.title}`,
          message: `A new challenge "${challenge.title}" has been published for ${classroom.name}. Review the details and submit your plan.`,
          templateSlug: "challenge-created",
          templateData: {
            link: scenarioLink,
            env: {
              SCALE_ADMIN_HOST: host,
              SCALE_API_HOST: process.env.SCALE_API_HOST || host,
            },
          },
          modelData: {
            challenge: challenge._id,
            classroom: classroomId,
            member: enrollment.userId,
            organization: organizationId,
          },
          organization: organizationId,
          createdBy: clerkUserId,
          updatedBy: clerkUserId,
        });
        return notification;
      } catch (error) {
        console.error(
          `Error creating notification for enrollment ${enrollment._id}:`,
          error.message,
        );
        throw error;
      }
    }),
  );

  const successful = notifications.filter(
    (n) => n.status === "fulfilled",
  ).length;
  const failed = notifications.filter((n) => n.status === "rejected").length;

  if (successful > 0) {
    console.log(
      `Created ${successful} notification(s) for challenge publication: ${challenge._id}`,
    );
  }

  if (failed > 0) {
    console.error(
      `Failed to create ${failed} notification(s) for challenge: ${challenge._id}`,
    );
  }
}

/**
 * Get profile type statistics aggregated from dynamic ledger metrics
 * @param {Array} submissionsWithStores - Array of decisions with profiles attached
 * @param {Array} metricDefinitions - Array of MetricDefinition documents for the classroom
 * @returns {Promise<Object>} Profile type statistics object
 */
scenarioSchema.statics.getStoreTypeStats = async function (
  submissionsWithStores,
  metricDefinitions = [],
) {
  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  const numericDefs = (metricDefinitions || []).filter(
    (md) => md && md.dataType === "number" && md.isActive !== false,
  );
  const leaderboardDef =
    MetricDefinition.selectLeaderboardDefinition(numericDefs);

  const emptyTotals = () => {
    const t = {};
    numericDefs.forEach((md) => {
      t[md.key] = 0;
    });
    return t;
  };

  const storeTypeStats = submissionsWithStores.reduce((acc, decision) => {
    const profile = decision.profile;
    const ledger = decision.ledgerEntryId;

    if (!profile || !ledger) {
      return acc;
    }

    const profileType = profile.profileType?.label;
    if (!acc[profileType]) {
      acc[profileType] = {
        profileType: profileType,
        count: 0,
        totals: emptyTotals(),
        averages: emptyTotals(),
        winners: [],
        losers: [],
        decisions: [],
      };
    }

    const stats = acc[profileType];
    stats.count += 1;

    const ledgerMetrics =
      (ledger.metrics && typeof ledger.metrics === "object"
        ? ledger.metrics
        : {}) || {};

    numericDefs.forEach((md) => {
      const raw = ledgerMetrics[md.key];
      const value = typeof raw === "number" ? raw : Number(raw) || 0;
      stats.totals[md.key] += value;
    });

    const decisionMetrics = {};
    numericDefs.forEach((md) => {
      const raw = ledgerMetrics[md.key];
      decisionMetrics[md.key] =
        typeof raw === "number" ? raw : Number(raw) || 0;
    });

    stats.decisions.push({
      userId: decision.userId,
      decisionId: decision._id,
      profile: {
        _id: profile._id,
        studentId: profile.studentId,
        shopName: profile.shopName,
        profileType: profile.profileType,
      },
      ledger: {
        metrics: decisionMetrics,
      },
    });

    return acc;
  }, {});

  Object.keys(storeTypeStats).forEach((profileType) => {
    const stats = storeTypeStats[profileType];
    const count = stats.count;

    numericDefs.forEach((md) => {
      stats.averages[md.key] = count > 0 ? stats.totals[md.key] / count : 0;
    });

    if (leaderboardDef) {
      const direction =
        leaderboardDef.leaderboardSortDirection === "asc" ? 1 : -1;
      const sorted = [...stats.decisions].sort((a, b) => {
        const aValue = Number(a.ledger.metrics?.[leaderboardDef.key]);
        const bValue = Number(b.ledger.metrics?.[leaderboardDef.key]);
        return (
          ((Number.isFinite(aValue) ? aValue : 0) -
            (Number.isFinite(bValue) ? bValue : 0)) *
          direction
        );
      });

      stats.winners = sorted.slice(0, 3).map((sub) => ({
        userId: sub.userId,
        decisionId: sub.decisionId,
        profile: sub.profile,
        metrics: sub.ledger.metrics,
        primaryMetricKey: leaderboardDef.key,
        primaryMetricValue: sub.ledger.metrics?.[leaderboardDef.key] ?? 0,
      }));

      const winnerDecisionIds = new Set(
        stats.winners.map((winner) => winner.decisionId.toString()),
      );

      stats.losers = sorted
        .filter((sub) => !winnerDecisionIds.has(sub.decisionId.toString()))
        .slice(-3)
        .reverse()
        .map((sub) => ({
          userId: sub.userId,
          decisionId: sub.decisionId,
          profile: sub.profile,
          metrics: sub.ledger.metrics,
          primaryMetricKey: leaderboardDef.key,
          primaryMetricValue: sub.ledger.metrics?.[leaderboardDef.key] ?? 0,
        }));
    } else {
      stats.winners = [];
      stats.losers = [];
    }

    delete stats.decisions;
  });

  return storeTypeStats;
};

/**
 * Get total enrolled students count for a classroom
 * @param {string} classroomId - Classroom ID
 * @returns {Promise<number>} Total enrolled students count
 */
scenarioSchema.statics.getTotalEnrolled = async function (classroomId) {
  const Enrollment = require("../enrollment/enrollment.model");
  return await Enrollment.countByClass(classroomId);
};

/**
 * Get submitted count for a challenge
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<number>} Submitted count
 */
scenarioSchema.statics.getSubmittedCount = async function (challengeId) {
  const Decision = require("../decision/decision.model");
  return await Decision.countDocuments({ challengeId });
};

/**
 * Get missing decisions count for a challenge
 * @param {string} classroomId - Classroom ID
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<number>} Missing decisions count
 */
scenarioSchema.statics.getMissingCount = async function (
  classroomId,
  challengeId,
) {
  const Decision = require("../decision/decision.model");
  const missingUserIds = await Decision.getMissingSubmissions(
    classroomId,
    challengeId,
  );
  return missingUserIds.length;
};

/**
 * Get missing decisions with user details for a challenge
 * @param {string} classroomId - Classroom ID
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<Array>} Array of missing users with details
 */
scenarioSchema.statics.getMissingSubmissions = async function (
  classroomId,
  challengeId,
) {
  const Decision = require("../decision/decision.model");
  const Member = require("../members/member.model");
  const Profile = require("../profile/profile.model");

  const missingUserIds = await Decision.getMissingSubmissions(
    classroomId,
    challengeId,
  );

  // Get user details for missing decisions
  const missingUsers = await Member.find({
    _id: { $in: missingUserIds },
  }).select("_id firstName lastName maskedEmail clerkUserId");

  // Get all profiles for this classroom
  const profiles = await Profile.getStoresByClass(classroomId);

  // Create a map of userId -> profile for quick lookup
  const storeMap = new Map();
  profiles.forEach((profile) => {
    // getStoresByClass already returns plain objects, but userId might be ObjectId
    const userId = profile.userId?.toString
      ? profile.userId.toString()
      : String(profile.userId);
    storeMap.set(userId, profile);
  });

  return missingUsers.map((u) => {
    const userObj = u.toObject();
    // Get profile for this user
    const profile = userObj._id
      ? storeMap.get(userObj._id.toString()) || null
      : null;

    return {
      ...userObj,
      email: u.maskedEmail,
      profile,
    };
  });
};

/**
 * Get stats for a challenge
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<Object>} Stats object
 */
scenarioSchema.statics.getStatsForScenario = async function (challengeId) {
  const Decision = require("../decision/decision.model");
  const Profile = require("../profile/profile.model");
  const MetricDefinition = require("../metricDefinition/metricDefinition.model");

  const challenge = await this.findById(challengeId);
  if (!challenge) {
    return null;
  }

  const decisions = await Decision.find({ challengeId: challengeId })
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
      select: "_id metrics summary",
    })
    .lean();

  const profiles = await Profile.getStoresByClass(challenge.classroomId);

  const storeMap = new Map();
  profiles.forEach((profile) => {
    storeMap.set(profile.userId.toString(), profile);
  });

  const submissionsWithStores = decisions.map((decision) => {
    const profile = storeMap.get(decision.userId._id.toString());
    return {
      ...decision,
      profile: profile || null,
    };
  });

  const metricDefinitions = await MetricDefinition.find({
    classroomId: challenge.classroomId,
    isActive: true,
  })
    .sort({ sortOrder: 1, label: 1 })
    .lean();

  const [storeTypeStats, totalEnrolled, submittedCount, missingCount] =
    await Promise.all([
      this.getStoreTypeStats(submissionsWithStores, metricDefinitions),
      this.getTotalEnrolled(challenge.classroomId),
      this.getSubmittedCount(challengeId),
      this.getMissingCount(challenge.classroomId, challengeId),
    ]);

  return {
    metricDefinitions,
    storeTypeStats: storeTypeStats,
    totalEnrolled: totalEnrolled,
    submittedCount: submittedCount,
    missingCount: missingCount,
  };
};

/**
 * Delete a challenge and all related data (cascade delete)
 * Deletes: outcome, decisions, ledger entries, jobs, variable values, and notifications
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<Object|null>} Deleted challenge or null if not found
 */
scenarioSchema.statics.deleteScenario = async function (challengeId) {
  // Lazy load models to avoid circular dependencies
  const Outcome = require("../outcome/outcome.model");
  const Decision = require("../decision/decision.model");
  const LedgerEntry = require("../ledger/ledger.model");
  const SimulationJob = require("../job/job.model");
  const VariableValue = require("../variableDefinition/variableValue.model");
  const Notification = require("../notifications/notifications.model");

  // Find the challenge first
  const challenge = await this.findById(challengeId);
  if (!challenge) {
    return null;
  }

  // Delete in order to avoid foreign key issues:
  // 1. Delete challenge outcome
  await Outcome.deleteOne({ challengeId });

  // 2. Delete ledger entries (these reference challengeId)
  await LedgerEntry.deleteMany({ challengeId });

  // 3. Delete simulation jobs (these reference challengeId)
  await SimulationJob.deleteMany({ challengeId });

  // 4. Get all decision IDs before deleting (needed for variable value cleanup)
  const decisions = await Decision.find({ challengeId }).select("_id").lean();
  const submissionIds = decisions.map((s) => s._id);

  // 5. Delete decisions (these reference challengeId)
  await Decision.deleteMany({ challengeId });

  // 6. Delete variable values for decisions (appliesTo: "decision", ownerId in submissionIds)
  if (submissionIds.length > 0) {
    await VariableValue.deleteMany({
      appliesTo: "decision",
      ownerId: { $in: submissionIds },
    });
  }

  // 7. Delete variable values for this challenge (appliesTo: "challenge", ownerId: challengeId)
  await VariableValue.deleteMany({
    appliesTo: "challenge",
    ownerId: challengeId,
  });

  // 7b. Delete variable definitions specific to this challenge (VariableDefinition: challengeId: challengeId)
  const VariableDefinition = require("../variableDefinition/variableDefinition.model");
  await VariableDefinition.deleteMany({ challengeId });

  // 8. Delete variable values for this challenge's outcome (appliesTo: "outcome")
  const outcomeDoc = await Outcome.findOne({ challengeId }).select("_id");
  if (outcomeDoc) {
    await VariableValue.deleteMany({
      appliesTo: "outcome",
      ownerId: outcomeDoc._id,
    });
  }

  // 8. Delete notifications that reference this challenge in modelData
  await Notification.deleteMany({
    "modelData.challenge": challengeId,
  });

  // 9. Finally, delete the challenge itself
  await this.findByIdAndDelete(challengeId);

  return challenge;
};

scenarioSchema.statics.processScenarioExport = async function (
  challengeId,
  organizationId,
) {
  const Decision = require("../decision/decision.model");
  const LedgerEntry = require("../ledger/ledger.model");
  const Profile = require("../profile/profile.model");
  const Classroom = require("../classroom/classroom.model");
  const AWS = require("aws-sdk");
  const { Parser } = require("json2csv");

  // Get challenge
  const challenge = await this.findById(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  // Get all decisions with populated user (don't use lean yet so we can populate variables)
  const submissionDocs = await Decision.find({ challengeId }).populate({
    path: "userId",
    select: "_id clerkUserId firstName lastName maskedEmail",
  });

  // Batch populate variables for all decisions
  await Decision.populateVariablesForMany(submissionDocs);

  const ledgerEntries = await LedgerEntry.find({ challengeId }).lean();

  const ledgerMap = new Map();
  ledgerEntries.forEach((ledger) => {
    ledgerMap.set(ledger.userId.toString(), ledger);
  });

  const classroomId = challenge.classroomId;

  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  const metricDefs = await MetricDefinition.find({
    classroomId,
    isActive: true,
  })
    .sort({ sortOrder: 1, label: 1 })
    .lean();
  const userIdsForStores = submissionDocs
    .map((s) => s?.userId?._id || s?.userId)
    .filter(Boolean);
  const profiles = userIdsForStores.length
    ? await Profile.find({ classroomId, userId: { $in: userIdsForStores } })
        .select("userId studentId shopName imageUrl")
        .lean()
    : [];
  const storeByUserId = new Map(
    (profiles || []).map((st) => [st.userId.toString(), st]),
  );

  // Flatten data for CSV
  const csvData = submissionDocs.map((decision) => {
    const submissionObj = decision.toObject();
    const userId =
      submissionObj.userId?._id?.toString() || submissionObj.userId?.toString();
    const ledger = userId ? ledgerMap.get(userId) : null;
    const profile = userId ? storeByUserId.get(userId) : null;
    const variables = submissionObj.variables || {};

    const row = {
      decisionId: submissionObj._id.toString(),
      submissionSubmittedAt: submissionObj.submittedAt
        ? new Date(submissionObj.submittedAt).toISOString()
        : "",
      submissionProcessingStatus: submissionObj.processingStatus || "pending",
      submissionGenerationMethod:
        submissionObj.generation?.method ||
        submissionObj.generationMethod ||
        "MANUAL",

      userId: userId || "",
      studentFirstName: submissionObj.userId?.firstName || "",
      studentLastName: submissionObj.userId?.lastName || "",
      studentEmail: submissionObj.userId?.maskedEmail || "",
      studentClerkUserId: submissionObj.userId?.clerkUserId || "",

      studentId: profile?.studentId || "",
      storeShopName: profile?.shopName || "",
      storeStudentId: profile?.studentId || "",

      ...Object.keys(variables).reduce((acc, key) => {
        const value = variables[key];
        acc[`submission_${key}`] =
          typeof value === "object" ? JSON.stringify(value) : value;
        return acc;
      }, {}),
    };

    // Dynamic metric columns, one per active MetricDefinition
    const ledgerMetrics =
      ledger && ledger.metrics && typeof ledger.metrics === "object"
        ? ledger.metrics
        : {};
    for (const def of metricDefs) {
      const raw = ledgerMetrics[def.key];
      row[`ledger_${def.key}`] =
        raw === undefined || raw === null
          ? ""
          : typeof raw === "object"
            ? JSON.stringify(raw)
            : raw;
    }

    if (ledger) {
      row.ledgerId = ledger._id.toString();
      row.ledgerRandomEvent = ledger.randomEvent || "";
      row.ledgerSummary = ledger.summary || "";
      row.ledgerOverridden = ledger.overridden || false;
      row.ledgerCreatedDate = ledger.createdDate
        ? new Date(ledger.createdDate).toISOString()
        : "";
    } else {
      row.ledgerId = "";
      row.ledgerRandomEvent = "";
      row.ledgerSummary = "";
      row.ledgerOverridden = "";
      row.ledgerCreatedDate = "";
    }

    return row;
  });

  if (csvData.length === 0)
    throw new Error("No decisions found for this challenge");

  const parser = new Parser();
  const csv = parser.parse(csvData);

  const toSlug = (str, wordLimit) =>
    (str || "")
      .trim()
      .split(/\s+/)
      .slice(0, wordLimit)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
      .filter(Boolean)
      .join("-")
      .toLowerCase();

  const classroom = await Classroom.findById(challenge.classroomId)
    .select("name")
    .lean();
  const classroomSlug = toSlug(classroom?.name || "", 3);
  const titleSlug = toSlug(challenge.title, 4);
  const slug =
    [classroomSlug, titleSlug].filter(Boolean).join("_") ||
    `challenge-${challengeId}`;
  const timestamp = Date.now();
  const fileName = `${slug}_${timestamp}.csv`;

  return {
    csv,
    fileName,
    total: csvData.length,
  };
};

const AUTOMATION_SYSTEM_USER = "system";

/**
 * Mark this challenge as blocked from automated lifecycle progression
 * @param {string} message - Reason the challenge was blocked
 * @returns {Promise<Object>} Updated challenge
 */
scenarioSchema.methods.markAutomationBlocked = async function (message) {
  this.automationStatus = "BLOCKED";
  this.automationError = message;
  this.automationLastCheckedAt = new Date();
  await this.save();
  return this;
};

/**
 * Publish all due scheduled challenges, independently of result automation.
 * @param {Date} now - Reference time for due-date comparison
 * @returns {Promise<Array>} Per-challenge result entries
 */
scenarioSchema.statics.publishDueScenarios = async function (now) {
  const dueScenarios = await this.find({
    isPublished: false,
    isClosed: false,
    publishAt: { $ne: null, $lte: now },
    $or: [
      { publishMode: "SCHEDULED" },
      { publishMode: { $exists: false } },
      { publishMode: null },
    ],
  }).sort({ publishAt: 1, week: 1 });

  const results = [];

  for (const challenge of dueScenarios) {
    try {
      const activeScenario = await this.getActiveScenario(
        challenge.classroomId,
      );
      if (
        activeScenario &&
        activeScenario._id.toString() !== challenge._id.toString()
      ) {
        await challenge.markAutomationBlocked(
          `Another challenge is already active: ${activeScenario.title}`,
        );
        results.push({
          challengeId: challenge._id,
          action: "publish",
          status: "blocked",
        });
        continue;
      }

      await challenge.publish(AUTOMATION_SYSTEM_USER);
      results.push({
        challengeId: challenge._id,
        action: "publish",
        status: "published",
      });
    } catch (error) {
      challenge.automationStatus = "FAILED";
      challenge.automationError = error.message;
      challenge.automationLastCheckedAt = new Date();
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "publish",
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Lock submissions for challenges whose closeSubmissionsAt has passed
 * @param {Date} now - Reference time for due-date comparison
 * @returns {Promise<Array>} Per-challenge result entries
 */
scenarioSchema.statics.closeDueSubmissions = async function (now) {
  const dueLocks = await this.find({
    automationMode: "FULL",
    isPublished: true,
    isClosed: false,
    isLockedForStudents: false,
    closeSubmissionsAt: { $ne: null, $lte: now },
  }).sort({ closeSubmissionsAt: 1, week: 1 });

  const results = [];

  for (const challenge of dueLocks) {
    try {
      challenge.isLockedForStudents = true;
      challenge.automationStatus = "submissionsClosed";
      challenge.automationLastCheckedAt = now;
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "lock",
        status: "locked",
      });
    } catch (error) {
      challenge.automationStatus = "FAILED";
      challenge.automationError = error.message;
      challenge.automationLastCheckedAt = new Date();
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "lock",
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Queue outcome processing for challenges whose processAt has passed
 * @param {Date} now - Reference time for due-date comparison
 * @returns {Promise<Array>} Per-challenge result entries
 */
scenarioSchema.statics.processDueOutcomes = async function (now) {
  const Outcome = require("../outcome/outcome.model");
  const {
    enqueueOutcomeProcessing,
  } = require("../../lib/queues/outcome-processing-worker");

  const dueScenarios = await this.find({
    automationMode: "FULL",
    isPublished: true,
    isClosed: false,
    processAt: { $ne: null, $lte: now },
    automationStatus: {
      $nin: [
        "queuedForProcessing",
        "processing",
        "processed",
        "feedbackReleased",
        "FAILED",
      ],
    },
  }).sort({ processAt: 1, week: 1 });

  const results = [];

  for (const challenge of dueScenarios) {
    try {
      const outcome = await Outcome.getOutcomeByScenario(challenge._id);
      if (!outcome) {
        await challenge.markAutomationBlocked(
          "A hidden outcome must be saved before automated processing can run",
        );
        results.push({
          challengeId: challenge._id,
          action: "process",
          status: "blocked",
        });
        continue;
      }

      if (!challenge.isLockedForStudents) {
        challenge.isLockedForStudents = true;
      }

      challenge.automationStatus = "queuedForProcessing";
      challenge.automationError = null;
      challenge.automationLastCheckedAt = now;
      await challenge.save();

      const queuedJob = await enqueueOutcomeProcessing({
        challengeId: challenge._id,
        organizationId: challenge.organization,
        clerkUserId: AUTOMATION_SYSTEM_USER,
      });

      results.push({
        challengeId: challenge._id,
        action: "process",
        status: "queued",
        outcomeProcessingJobId: queuedJob?.id,
      });
    } catch (error) {
      challenge.automationStatus = "FAILED";
      challenge.automationError = error.message;
      challenge.automationLastCheckedAt = new Date();
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "process",
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Release delayed feedback for closed challenges whose feedbackReleaseAt has passed
 * @param {Date} now - Reference time for due-date comparison
 * @returns {Promise<Array>} Per-challenge result entries
 */
scenarioSchema.statics.releaseDelayedFeedback = async function (now) {
  const dueReleases = await this.find({
    automationMode: "FULL",
    isPublished: true,
    isClosed: true,
    isFeedbackReleased: false,
    feedbackReleaseMode: "DELAYED",
    automationStatus: "processed",
    feedbackReleaseAt: { $ne: null, $lte: now },
  }).sort({ feedbackReleaseAt: 1, week: 1 });

  const results = [];
  const SimulationJob = require("../job/job.model");

  for (const challenge of dueReleases) {
    try {
      const hasNonTerminalJobs = await SimulationJob.exists({
        challengeId: challenge._id,
        status: { $in: ["pending", "running"] },
      });
      if (hasNonTerminalJobs) continue;

      challenge.isFeedbackReleased = true;
      challenge.automationStatus = "feedbackReleased";
      challenge.automationLastCheckedAt = now;
      await challenge.save();

      const LedgerEntry = require("../ledger/ledger.model");
      await LedgerEntry.sendResultsNotifications(challenge._id);

      results.push({
        challengeId: challenge._id,
        action: "release",
        status: "released",
      });
    } catch (error) {
      challenge.automationStatus = "FAILED";
      challenge.automationError = error.message;
      challenge.automationLastCheckedAt = new Date();
      await challenge.save();
      results.push({
        challengeId: challenge._id,
        action: "release",
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Run the full automated scenario lifecycle check (publish, lock, process, release)
 * @param {Object} options
 * @param {Date|string} [options.now] - Override reference time (defaults to now)
 * @returns {Promise<Object>} Summary of lifecycle actions taken
 */
scenarioSchema.statics.runScenarioLifecycleCheck = async function (
  options = {},
) {
  const now = options.now ? new Date(options.now) : new Date();
  const published = await this.publishDueScenarios(now);
  const locked = await this.closeDueSubmissions(now);
  const processed = await this.processDueOutcomes(now);
  const released = await this.releaseDelayedFeedback(now);

  return {
    now,
    published,
    locked,
    processed,
    released,
    publishedCount: published.filter((result) => result.status === "published")
      .length,
    lockedCount: locked.filter((result) => result.status === "locked").length,
    queuedCount: processed.filter((result) => result.status === "queued")
      .length,
    releasedCount: released.filter((result) => result.status === "released")
      .length,
    blockedCount: [...published, ...processed].filter(
      (result) => result.status === "blocked",
    ).length,
    failedCount: [...published, ...locked, ...processed, ...released].filter(
      (result) => result.status === "failed",
    ).length,
  };
};

const Challenge = mongoose.model("Challenge", scenarioSchema);

module.exports = Challenge;
