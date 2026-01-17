const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const Scenario = require("../scenario/scenario.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");

const submissionSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  // Tracks how this submission was created (manual student submission vs automation).
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
      ref: "Scenario",
      default: null,
    },
    forwardedFromSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
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
  // Convenience pointer to the most recent ledger entry generated for this submission
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
}).add(baseSchema);

// Apply variable population plugin
submissionSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "submission",
  outputFormat: "valueMap",
});

// Compound indexes for performance
submissionSchema.index(
  { classroomId: 1, scenarioId: 1, userId: 1 },
  { unique: true }
);
submissionSchema.index({ scenarioId: 1, userId: 1 });
submissionSchema.index({ classroomId: 1, userId: 1 });
submissionSchema.index({ scenarioId: 1 });
submissionSchema.index({ organization: 1, scenarioId: 1 });
submissionSchema.index({ ledgerEntryId: 1 });

// Static methods - Shared utilities for submission operations

/**
 * Validate submission variables against VariableDefinition
 * @param {string} classroomId - Class ID
 * @param {Object} variables - Variables object to validate
 * @returns {Promise<Object>} Validation result
 */
submissionSchema.statics.validateSubmissionVariables = async function (
  classroomId,
  variables
) {
  return await VariableDefinition.validateValues(
    classroomId,
    "submission",
    variables
  );
};

/**
 * Check if submission exists
 * @param {string} classroomId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @returns {Promise<boolean>} True if submission exists
 */
submissionSchema.statics.submissionExists = async function (
  classroomId,
  scenarioId,
  userId
) {
  const count = await this.countDocuments({ classroomId, scenarioId, userId });
  return count > 0;
};

/**
 * Create a submission
 * @param {string} classroomId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created submission with variables populated
 */
submissionSchema.statics.createSubmission = async function (
  classroomId,
  scenarioId,
  userId,
  variables,
  organizationId,
  clerkUserId,
  createOptions = {}
) {
  // Check if submission already exists
  const exists = await this.submissionExists(classroomId, scenarioId, userId);
  if (exists) {
    throw new Error("Submission already exists for this scenario");
  }

  // Validate variables
  const validation = await this.validateSubmissionVariables(
    classroomId,
    variables
  );
  if (!validation.isValid) {
    throw new Error(
      `Invalid submission variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    "submission",
    variables
  );

  // Verify scenario is published and not closed
  const scenario = await Scenario.findById(scenarioId);
  if (!scenario) {
    throw new Error("Scenario not found");
  }
  if (!scenario.isPublished) {
    throw new Error("Scenario is not published");
  }
  if (scenario.isClosed) {
    throw new Error("Scenario is closed");
  }

  // Create submission document
  const submission = new this({
    classroomId,
    scenarioId,
    userId,
    submittedAt: new Date(),
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  // Optional generation metadata (defaults to MANUAL if not provided)
  if (createOptions && typeof createOptions === "object") {
    const gen = createOptions.generation;
    if (gen && typeof gen === "object") {
      submission.generation = {
        method: gen.method || undefined,
        forwardedFromScenarioId: gen.forwardedFromScenarioId || null,
        forwardedFromSubmissionId: gen.forwardedFromSubmissionId || null,
        meta: gen.meta !== undefined ? gen.meta : null,
      };
    }
  }

  await submission.save();

  // Create variable values if provided
  if (variablesWithDefaults && Object.keys(variablesWithDefaults).length > 0) {
    const variableEntries = Object.entries(variablesWithDefaults);
    const variableDocs = variableEntries.map(([key, value]) => ({
      classroomId,
      appliesTo: "submission",
      ownerId: submission._id,
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

  // Return submission with variables populated (auto-loaded via plugin)
  const createdSubmission = await this.findOne({
    classroomId,
    scenarioId,
    userId,
  });
  return createdSubmission ? createdSubmission.toObject() : null;
};

/**
 * Update a submission
 * @param {string} classroomId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated submission with variables populated
 */
submissionSchema.statics.updateSubmission = async function (
  classroomId,
  scenarioId,
  userId,
  variables,
  organizationId,
  clerkUserId
) {
  // Find existing submission
  const submission = await this.findOne({ classroomId, scenarioId, userId });
  if (!submission) {
    throw new Error("Submission not found");
  }

  // Verify scenario is published and not closed
  const scenario = await Scenario.findById(scenarioId);
  if (!scenario) {
    throw new Error("Scenario not found");
  }
  if (!scenario.isPublished) {
    throw new Error("Scenario is not published");
  }
  if (scenario.isClosed) {
    throw new Error("Scenario is closed");
  }

  // Validate variables
  const validation = await this.validateSubmissionVariables(
    classroomId,
    variables
  );
  if (!validation.isValid) {
    throw new Error(
      `Invalid submission variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    "submission",
    variables
  );

  // Update submission document
  submission.updatedBy = clerkUserId;
  submission.updatedDate = new Date();
  await submission.save();

  // Delete existing variable values
  await VariableValue.deleteMany({
    classroomId,
    appliesTo: "submission",
    ownerId: submission._id,
  });

  // Create new variable values if provided
  if (variablesWithDefaults && Object.keys(variablesWithDefaults).length > 0) {
    const variableEntries = Object.entries(variablesWithDefaults);
    const variableDocs = variableEntries.map(([key, value]) => ({
      classroomId,
      appliesTo: "submission",
      ownerId: submission._id,
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

  // Return submission with variables populated (auto-loaded via plugin)
  const updatedSubmission = await this.findOne({
    classroomId,
    scenarioId,
    userId,
  });
  return updatedSubmission ? updatedSubmission.toObject() : null;
};

/**
 * Get submissions for a scenario (normalized for AI)
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Array>} Array of normalized submission objects
 */
submissionSchema.statics.getSubmissionsByScenario = async function (
  scenarioId
) {
  const submissions = await this.find({ scenarioId })
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
      select:
        "_id sales revenue costs waste cashBefore cashAfter inventoryState netProfit randomEvent summary",
    });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(submissions);

  // Variables are automatically included via plugin (already in array format with full definitions)
  return submissions.map((submission) => {
    const submissionObj = submission.toObject();
    // Ensure legacy submissions (created before generation metadata existed) still expose a method.
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
      member: submission.userId
        ? {
            _id: submission.userId._id,
            clerkUserId: submission.userId.clerkUserId,
            email: submission.userId.maskedEmail,
            firstName: submission.userId.firstName,
            lastName: submission.userId.lastName,
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
 * Get missing submissions for a scenario
 * @param {string} classroomId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Array>} Array of user IDs who haven't submitted (only org:member role)
 */
submissionSchema.statics.getMissingSubmissions = async function (
  classroomId,
  scenarioId
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

  // Get all submissions for this scenario (use lean to avoid population issues)
  const submissions = await this.find({ scenarioId }).lean();
  const submittedUserIds = new Set(submissions.map((s) => s.userId.toString()));

  // Find missing user IDs (convert to string for comparison)
  const missingUserIds = enrolledUserIds.filter((userId) => {
    const userIdStr = userId.toString();
    return !submittedUserIds.has(userIdStr);
  });

  return missingUserIds;
};

/**
 * Get submission for a user and scenario
 * @param {string} classroomId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Submission with variables or null
 */
submissionSchema.statics.getSubmission = async function (
  classroomId,
  scenarioId,
  userId
) {
  const submission = await this.findOne({
    classroomId,
    scenarioId,
    userId,
  }).populate({
    path: "jobs",
    select: "_id status error attempts startedAt completedAt dryRun",
  });
  if (!submission) {
    return null;
  }

  // Explicitly populate variables before returning (post-init hook may not complete in time)
  await this.populateVariablesForMany([submission]);
  const submissionObj = submission.toObject();
  // Ensure legacy submissions (created before generation metadata existed) still expose a method.
  submissionObj.generation =
    submissionObj.generation && typeof submissionObj.generation === "object"
      ? {
          ...submissionObj.generation,
          method: submissionObj.generation.method || "MANUAL",
        }
      : { method: "MANUAL" };
  // Ensure _id is included (should be by default, but make it explicit)
  submissionObj._id = submission._id;
  submissionObj.jobs = submissionObj.jobs || [];
  submissionObj.processingStatus = submissionObj.processingStatus || "pending";
  return submissionObj;
};

/**
 * Get all submissions for a user
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Array>} Array of submissions with variables
 */
submissionSchema.statics.getSubmissionsByUser = async function (
  classroomId,
  userId
) {
  const submissions = await this.find({ classroomId, userId })
    .populate({
      path: "jobs",
      select: "_id status error attempts startedAt completedAt dryRun",
    })
    .sort({
      submittedAt: 1,
    });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(submissions);

  // Variables are automatically included via plugin
  return submissions.map((submission) => {
    const submissionObj = submission.toObject();
    // Ensure legacy submissions (created before generation metadata existed) still expose a method.
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

// Instance methods

/**
 * Populate variables for this submission instance
 * Loads and caches variables so they're available in toObject()/toJSON()
 * @returns {Promise<this>} This submission instance with variables populated
 */
submissionSchema.methods.populateVariables = async function () {
  // Load variables (will be cached by the plugin)
  await this._loadVariables();
  return this;
};

/**
 * Get variables for this submission instance
 * Uses cached variables if available, otherwise loads them
 * @returns {Promise<Object>} Variables object
 */
submissionSchema.methods.getVariables = async function () {
  // Use plugin's cached variables or load them
  return await this._loadVariables();
};

/**
 * Check if submission can be edited
 * @returns {boolean} Always false - submissions are immutable
 */
submissionSchema.methods.canEdit = function () {
  return false; // Submissions are immutable after creation
};

/**
 * Add a job to this submission
 * @param {string} jobId - Job ID to add
 * @returns {Promise<this>} Updated submission
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
 * @returns {Promise<this>} Updated submission
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

const Submission = mongoose.model("Submission", submissionSchema);

module.exports = Submission;
