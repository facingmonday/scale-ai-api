const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const scenarioVariableValueSchema = new mongoose.Schema({
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
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
scenarioVariableValueSchema.index(
  { scenarioId: 1, variableKey: 1 },
  { unique: true }
);
scenarioVariableValueSchema.index({ scenarioId: 1 });
scenarioVariableValueSchema.index({ organization: 1, scenarioId: 1 });

// Static methods

/**
 * Get all variables for a scenario
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Array>} Array of variable value documents
 */
scenarioVariableValueSchema.statics.findByScenario = function (scenarioId) {
  return this.find({ scenarioId });
};

/**
 * Get variable value by key for a scenario
 * @param {string} scenarioId - Scenario ID
 * @param {string} variableKey - Variable key
 * @returns {Promise<Object|null>} Variable value document or null
 */
scenarioVariableValueSchema.statics.findByScenarioAndKey = function (
  scenarioId,
  variableKey
) {
  return this.findOne({ scenarioId, variableKey });
};

/**
 * Set or update a variable value
 * @param {string} scenarioId - Scenario ID
 * @param {string} variableKey - Variable key
 * @param {*} value - Variable value
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} Variable value document
 */
scenarioVariableValueSchema.statics.setVariable = async function (
  scenarioId,
  variableKey,
  value,
  organizationId,
  clerkUserId
) {
  const existing = await this.findOne({ scenarioId, variableKey });

  if (existing) {
    existing.value = value;
    existing.updatedBy = clerkUserId;
    await existing.save();
    return existing;
  }

  const variableValue = new this({
    scenarioId,
    variableKey,
    value,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await variableValue.save();
  return variableValue;
};

const ScenarioVariableValue = mongoose.model(
  "ScenarioVariableValue",
  scenarioVariableValueSchema
);

module.exports = ScenarioVariableValue;
