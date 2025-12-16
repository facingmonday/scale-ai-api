const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const submissionVariableValueSchema = new mongoose.Schema({
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Submission",
    required: true,
  },
  variableKey: {
    type: String,
    required: true,
    index: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}).add(baseSchema);

// Compound indexes for performance
submissionVariableValueSchema.index(
  { submissionId: 1, variableKey: 1 },
  { unique: true }
);
submissionVariableValueSchema.index({ submissionId: 1 });
submissionVariableValueSchema.index({ organization: 1, submissionId: 1 });

// Static methods

/**
 * Get all variables for a submission
 * @param {string} submissionId - Submission ID
 * @returns {Promise<Array>} Array of variable value documents
 */
submissionVariableValueSchema.statics.findBySubmission = function (
  submissionId
) {
  return this.find({ submissionId });
};

/**
 * Get variable value by key for a submission
 * @param {string} submissionId - Submission ID
 * @param {string} variableKey - Variable key
 * @returns {Promise<Object|null>} Variable value document or null
 */
submissionVariableValueSchema.statics.findBySubmissionAndKey = function (
  submissionId,
  variableKey
) {
  return this.findOne({ submissionId, variableKey });
};

/**
 * Set or update a variable value
 * @param {string} submissionId - Submission ID
 * @param {string} variableKey - Variable key
 * @param {*} value - Variable value
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} Variable value document
 */
submissionVariableValueSchema.statics.setVariable = async function (
  submissionId,
  variableKey,
  value,
  organizationId,
  clerkUserId
) {
  const existing = await this.findOne({ submissionId, variableKey });

  if (existing) {
    existing.value = value;
    existing.updatedBy = clerkUserId;
    await existing.save();
    return existing;
  }

  const variableValue = new this({
    submissionId,
    variableKey,
    value,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await variableValue.save();
  return variableValue;
};

const SubmissionVariableValue = mongoose.model(
  "SubmissionVariableValue",
  submissionVariableValueSchema
);

module.exports = SubmissionVariableValue;
