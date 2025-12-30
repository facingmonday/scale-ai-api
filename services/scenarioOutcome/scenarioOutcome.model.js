const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const LedgerEntry = require("../ledger/ledger.model");

const scenarioOutcomeSchema = new mongoose.Schema({
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: true,
    unique: true,
  },
  notes: {
    type: String,
    default: "",
  },
  hiddenNotes: {
    type: String,
    default: "",
  },
  // Probability (0-100) that a random event will occur for this scenario outcome.
  // Default 0 means random events are disabled.
  randomEventChancePercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
}).add(baseSchema);

// Indexes for performance
// scenarioId already has a unique index from unique: true
scenarioOutcomeSchema.index({ organization: 1, scenarioId: 1 });

// Static methods - Shared utilities for scenario outcome operations

/**
 * Create or update scenario outcome
 * @param {string} scenarioId - Scenario ID
 * @param {Object} outcomeData - Outcome data
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created or updated outcome
 */
scenarioOutcomeSchema.statics.createOrUpdateOutcome = async function (
  scenarioId,
  outcomeData,
  organizationId,
  clerkUserId
) {
  let outcome = await this.findOne({ scenarioId });

  const normalizedChancePercent =
    outcomeData.randomEventChancePercent !== undefined
      ? outcomeData.randomEventChancePercent
      : undefined;

  if (outcome) {
    // Update existing outcome
    outcome.notes = outcomeData.notes || outcome.notes;
    if (normalizedChancePercent !== undefined) {
      outcome.randomEventChancePercent = normalizedChancePercent;
    }
    outcome.updatedBy = clerkUserId;
    await outcome.save();
  } else {
    // Create new outcome
    outcome = new this({
      scenarioId,
      notes: outcomeData.notes || "",
      randomEventChancePercent:
        normalizedChancePercent !== undefined ? normalizedChancePercent : 0,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    await outcome.save();
  }

  return outcome;
};

/**
 * Get outcome by scenario ID
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Object|null>} Outcome or null
 */
scenarioOutcomeSchema.statics.getOutcomeByScenario = async function (
  scenarioId
) {
  return await this.findOne({ scenarioId });
};

/**
 * Delete outcome by scenario ID
 * Also deletes all related ledger entries for this scenario
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Object|null>} Deleted outcome or null
 */
scenarioOutcomeSchema.statics.deleteOutcome = async function (scenarioId) {
  // Delete all ledger entries for this scenario first
  await LedgerEntry.deleteLedgerEntriesForScenario(scenarioId);

  // Then delete the outcome
  return await this.findOneAndDelete({ scenarioId });
};

const ScenarioOutcome = mongoose.model(
  "ScenarioOutcome",
  scenarioOutcomeSchema
);

module.exports = ScenarioOutcome;
