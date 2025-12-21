const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const Scenario = require("../scenario/scenario.model");
const SubmissionVariableValue = require("./submissionVariableValue.model");
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
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}).add(baseSchema);

// Apply variable population plugin
submissionSchema.plugin(variablePopulationPlugin, {
  variableValueModel: SubmissionVariableValue,
  foreignKeyField: "submissionId",
  appliesTo: "submission",
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
 * Check if student has submitted for previous scenarios
 * Enforces ordering - must submit in order
 * Late joiners can submit for the active scenario even if they missed previous weeks
 * @param {string} classroomId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object>} { canSubmit: boolean, reason?: string }
 */
submissionSchema.statics.checkSubmissionOrder = async function (
  classroomId,
  scenarioId,
  userId
) {
  // Get the scenario to check its week number and status
  const scenario = await Scenario.findById(scenarioId);
  if (!scenario) {
    return { canSubmit: false, reason: "Scenario not found" };
  }

  // If it's week 1, always allow
  if (scenario.week === 1) {
    return { canSubmit: true };
  }

  // If scenario is the active (published and not closed) scenario, allow submission
  // This allows late joiners to start at the current scenario
  if (scenario.isPublished && !scenario.isClosed) {
    const activeScenario = await Scenario.getActiveScenario(classroomId);
    if (
      activeScenario &&
      activeScenario._id.toString() === scenarioId.toString()
    ) {
      return { canSubmit: true };
    }
  }

  // Check if previous week was submitted
  const previousWeek = scenario.week - 1;
  const previousScenarios = await Scenario.find({
    classroomId,
    week: previousWeek,
  }).sort({ createdDate: -1 });

  if (previousScenarios.length === 0) {
    // No previous scenario exists, allow submission
    return { canSubmit: true };
  }

  // Check if student submitted for the most recent previous scenario
  const previousScenario = previousScenarios[0];
  const previousSubmission = await this.findOne({
    classroomId,
    scenarioId: previousScenario._id,
    userId,
  });

  if (!previousSubmission) {
    return {
      canSubmit: false,
      reason: `Must submit for week ${previousWeek} before submitting for week ${scenario.week}`,
    };
  }

  return { canSubmit: true };
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
  clerkUserId
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

  // Check submission order
  const orderCheck = await this.checkSubmissionOrder(
    classroomId,
    scenarioId,
    userId
  );
  if (!orderCheck.canSubmit) {
    throw new Error(orderCheck.reason || "Cannot submit out of order");
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

  await submission.save();

  // Create variable values if provided
  if (variablesWithDefaults && Object.keys(variablesWithDefaults).length > 0) {
    const variableEntries = Object.entries(variablesWithDefaults);
    const variableDocs = variableEntries.map(([key, value]) => ({
      submissionId: submission._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await SubmissionVariableValue.insertMany(variableDocs);
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
  await SubmissionVariableValue.deleteMany({
    submissionId: submission._id,
  });

  // Create new variable values if provided
  if (variablesWithDefaults && Object.keys(variablesWithDefaults).length > 0) {
    const variableEntries = Object.entries(variablesWithDefaults);
    const variableDocs = variableEntries.map(([key, value]) => ({
      submissionId: submission._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await SubmissionVariableValue.insertMany(variableDocs);
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
  const submissions = await this.find({ scenarioId }).populate({
    path: "userId",
    select: "_id clerkUserId firstName lastName maskedEmail",
  });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(submissions);

  // Variables are automatically included via plugin (already in array format with full definitions)
  return submissions.map((submission) => {
    const submissionObj = submission.toObject();

    return {
      ...submissionObj,
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

  const enrolledUserIds = filteredEnrollments.map((e) => e.userId);

  // Get all submissions for this scenario
  const submissions = await this.find({ scenarioId });
  const submittedUserIds = submissions.map((s) => s.userId.toString());

  // Find missing user IDs
  const missingUserIds = enrolledUserIds.filter(
    (userId) => !submittedUserIds.includes(userId.toString())
  );

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
  const submission = await this.findOne({ classroomId, scenarioId, userId });
  if (!submission) {
    return null;
  }

  // Explicitly populate variables before returning (post-init hook may not complete in time)
  await this.populateVariablesForMany([submission]);
  const submissionObj = submission.toObject();
  // Ensure _id is included (should be by default, but make it explicit)
  submissionObj._id = submission._id;
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
  const submissions = await this.find({ classroomId, userId }).sort({
    submittedAt: 1,
  });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(submissions);

  // Variables are automatically included via plugin
  return submissions.map((submission) => submission.toObject());
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

const Submission = mongoose.model("Submission", submissionSchema);

module.exports = Submission;
