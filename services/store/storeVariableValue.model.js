const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const storeVariableValueSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
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

// Compound indexes for performance
storeVariableValueSchema.index({ storeId: 1, variableKey: 1 }, { unique: true });
storeVariableValueSchema.index({ storeId: 1 });
storeVariableValueSchema.index({ organization: 1, storeId: 1 });

// Static methods

/**
 * Get all variables for a store
 * @param {string} storeId - Store ID
 * @returns {Promise<Array>} Array of variable value documents
 */
storeVariableValueSchema.statics.findByStore = function (storeId) {
  return this.find({ storeId });
};

/**
 * Get variable value by key for a store
 * @param {string} storeId - Store ID
 * @param {string} variableKey - Variable key
 * @returns {Promise<Object|null>} Variable value document or null
 */
storeVariableValueSchema.statics.findByStoreAndKey = function (
  storeId,
  variableKey
) {
  return this.findOne({ storeId, variableKey });
};

/**
 * Set or update a variable value
 * @param {string} storeId - Store ID
 * @param {string} variableKey - Variable key
 * @param {*} value - Variable value
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} Variable value document
 */
storeVariableValueSchema.statics.setVariable = async function (
  storeId,
  variableKey,
  value,
  organizationId,
  clerkUserId
) {
  const existing = await this.findOne({ storeId, variableKey });

  if (existing) {
    existing.value = value;
    existing.updatedBy = clerkUserId;
    await existing.save();
    return existing;
  }

  const variableValue = new this({
    storeId,
    variableKey,
    value,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await variableValue.save();
  return variableValue;
};

const StoreVariableValue = mongoose.model(
  "StoreVariableValue",
  storeVariableValueSchema
);

module.exports = StoreVariableValue;

