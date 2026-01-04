const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

/**
 * Polymorphic variable value storage.
 *
 * Stores a value for a VariableDefinition key, scoped to:
 * - appliesTo: which kind of document this value belongs to (store/scenario/submission/...)
 * - ownerId: the _id of the owning document
 *
 * This replaces the old per-model collections:
 * - StoreVariableValue
 * - ScenarioVariableValue
 * - SubmissionVariableValue
 */
const variableValueSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  appliesTo: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
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

// Compound indexes for performance + uniqueness
variableValueSchema.index(
  { organization: 1, classroomId: 1, appliesTo: 1, ownerId: 1, variableKey: 1 },
  { unique: true }
);
variableValueSchema.index({ classroomId: 1, appliesTo: 1, ownerId: 1 });
variableValueSchema.index({ organization: 1, classroomId: 1, appliesTo: 1, ownerId: 1 });

// Static methods

/**
 * Get all variables for an owner
 * @param {string} appliesTo - Scope ("store", "scenario", "submission", ...)
 * @param {string} ownerId - Owning document ID
 * @returns {Promise<Array>} Array of variable value documents
 */
variableValueSchema.statics.findByOwner = function (appliesTo, ownerId) {
  return this.find({ appliesTo, ownerId });
};

/**
 * Get variable value by key for an owner
 * @param {string} appliesTo - Scope ("store", "scenario", "submission", ...)
 * @param {string} ownerId - Owning document ID
 * @param {string} variableKey - Variable key
 * @returns {Promise<Object|null>} Variable value document or null
 */
variableValueSchema.statics.findByOwnerAndKey = function (
  appliesTo,
  ownerId,
  variableKey
) {
  return this.findOne({ appliesTo, ownerId, variableKey });
};

/**
 * Set or update a variable value
 * @param {string} classroomId - Classroom ID
 * @param {string} appliesTo - Scope ("store", "scenario", "submission", "storeType")
 * @param {string} ownerId - Owning document ID
 * @param {string} variableKey - Variable key
 * @param {*} value - Variable value
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} Variable value document
 */
variableValueSchema.statics.setVariable = async function (
  classroomId,
  appliesTo,
  ownerId,
  variableKey,
  value,
  organizationId,
  clerkUserId
) {
  if (!classroomId) {
    throw new Error("classroomId is required");
  }

  const existing = await this.findOne({
    classroomId,
    appliesTo,
    ownerId,
    variableKey,
  });

  if (existing) {
    existing.value = value;
    existing.updatedBy = clerkUserId;
    await existing.save();
    return existing;
  }

  const variableValue = new this({
    classroomId,
    appliesTo,
    ownerId,
    variableKey,
    value,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await variableValue.save();
  return variableValue;
};

const VariableValue = mongoose.model("VariableValue", variableValueSchema);

module.exports = VariableValue;


