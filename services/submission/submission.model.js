const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const Scenario = require("../scenario/scenario.model");

const submissionSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    index: true,
  },
  variables: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {},
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}).add(baseSchema);

// Compound indexes for performance
submissionSchema.index({ classId: 1, scenarioId: 1, userId: 1 }, { unique: true });
submissionSchema.index({ scenarioId: 1, userId: 1 });
submissionSchema.index({ classId: 1, userId: 1 });
submissionSchema.index({ scenarioId: 1 });
submissionSchema.index({ organization: 1, scenarioId: 1 });

// Static methods - Shared utilities for submission operations

/**
 * Validate submission variables against VariableDefinition
 * @param {string} classId - Class ID
 * @param {Object} variables - Variables object to validate
 * @returns {Promise<Object>} Validation result
 */
submissionSchema.statics.validateSubmissionVariables = async function (
  classId,
  variables
) {
  return await VariableDefinition.validateValues(
    classId,
    "submission",
    variables
  );
};

/**
 * Check if submission exists
 * @param {string} classId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @returns {Promise<boolean>} True if submission exists
 */
submissionSchema.statics.submissionExists = async function (
  classId,
  scenarioId,
  userId
) {
  const count = await this.countDocuments({ classId, scenarioId, userId });
  return count > 0;
};

/**
 * Check if student has submitted for previous scenarios
 * Enforces ordering - must submit in order
 * Late joiners can submit for the active scenario even if they missed previous weeks
 * @param {string} classId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object>} { canSubmit: boolean, reason?: string }
 */
submissionSchema.statics.checkSubmissionOrder = async function (
  classId,
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
    const activeScenario = await Scenario.getActiveScenario(classId);
    if (activeScenario && activeScenario._id.toString() === scenarioId.toString()) {
      return { canSubmit: true };
    }
  }

  // Check if previous week was submitted
  const previousWeek = scenario.week - 1;
  const previousScenarios = await Scenario.find({
    classId,
    week: previousWeek,
  }).sort({ createdDate: -1 });

  if (previousScenarios.length === 0) {
    // No previous scenario exists, allow submission
    return { canSubmit: true };
  }

  // Check if student submitted for the most recent previous scenario
  const previousScenario = previousScenarios[0];
  const previousSubmission = await this.findOne({
    classId,
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
 * @param {string} classId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created submission
 */
submissionSchema.statics.createSubmission = async function (
  classId,
  scenarioId,
  userId,
  variables,
  organizationId,
  clerkUserId
) {
  // Check if submission already exists
  const exists = await this.submissionExists(classId, scenarioId, userId);
  if (exists) {
    throw new Error("Submission already exists for this scenario");
  }

  // Validate variables
  const validation = await this.validateSubmissionVariables(classId, variables);
  if (!validation.isValid) {
    throw new Error(
      `Invalid submission variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    classId,
    "submission",
    variables
  );

  // Check submission order
  const orderCheck = await this.checkSubmissionOrder(classId, scenarioId, userId);
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

  const submission = new this({
    classId,
    scenarioId,
    userId,
    variables: variablesWithDefaults,
    submittedAt: new Date(),
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await submission.save();
  return submission;
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
    select: "_id clerkUserId firstName lastName",
  });

  return submissions.map((submission) => ({
    userId: submission.userId._id,
    clerkUserId: submission.userId.clerkUserId,
    variables: submission.variables,
    submittedAt: submission.submittedAt,
  }));
};

/**
 * Get missing submissions for a scenario
 * @param {string} classId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Array>} Array of user IDs who haven't submitted
 */
submissionSchema.statics.getMissingSubmissions = async function (
  classId,
  scenarioId
) {
  const Enrollment = require("../enrollment/enrollment.model");

  // Get all enrolled students (members)
  const enrollments = await Enrollment.findByClass(classId);
  const enrolledUserIds = enrollments.map((e) => e.userId);

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
 * @param {string} classId - Class ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Submission or null
 */
submissionSchema.statics.getSubmission = async function (
  classId,
  scenarioId,
  userId
) {
  return await this.findOne({ classId, scenarioId, userId });
};

/**
 * Get all submissions for a user
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Array>} Array of submissions
 */
submissionSchema.statics.getSubmissionsByUser = async function (
  classId,
  userId
) {
  return await this.find({ classId, userId }).sort({ submittedAt: 1 });
};

// Instance methods

/**
 * Check if submission can be edited
 * @returns {boolean} Always false - submissions are immutable
 */
submissionSchema.methods.canEdit = function () {
  return false; // Submissions are immutable after creation
};

const Submission = mongoose.model("Submission", submissionSchema);

module.exports = Submission;

