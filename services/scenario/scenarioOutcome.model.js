const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const scenarioOutcomeSchema = new mongoose.Schema({
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: true,
    unique: true,
    index: true,
  },
  actualWeather: {
    type: String,
    default: "",
  },
  demandShift: {
    type: Number,
    default: 1.0,
  },
  notes: {
    type: String,
    default: "",
  },
  randomEventsEnabled: {
    type: Boolean,
    default: false,
  },
  approved: {
    type: Boolean,
    default: false,
  },
}).add(baseSchema);

// Indexes for performance
scenarioOutcomeSchema.index({ scenarioId: 1 });
scenarioOutcomeSchema.index({ approved: 1 });
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

  if (outcome) {
    // Update existing outcome
    outcome.actualWeather = outcomeData.actualWeather || outcome.actualWeather;
    outcome.demandShift =
      outcomeData.demandShift !== undefined
        ? outcomeData.demandShift
        : outcome.demandShift;
    outcome.notes = outcomeData.notes || outcome.notes;
    outcome.randomEventsEnabled =
      outcomeData.randomEventsEnabled !== undefined
        ? outcomeData.randomEventsEnabled
        : outcome.randomEventsEnabled;
    outcome.approved = false; // Reset approval when updating
    outcome.updatedBy = clerkUserId;
    await outcome.save();
  } else {
    // Create new outcome
    outcome = new this({
      scenarioId,
      actualWeather: outcomeData.actualWeather || "",
      demandShift: outcomeData.demandShift !== undefined ? outcomeData.demandShift : 1.0,
      notes: outcomeData.notes || "",
      randomEventsEnabled:
        outcomeData.randomEventsEnabled !== undefined
          ? outcomeData.randomEventsEnabled
          : false,
      approved: false,
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

// Instance methods

/**
 * Approve this outcome
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated outcome
 */
scenarioOutcomeSchema.methods.approve = async function (clerkUserId) {
  this.approved = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Check if outcome can be edited
 * @returns {boolean} True if can be edited
 */
scenarioOutcomeSchema.methods.canEdit = function () {
  // Can edit if not approved
  return !this.approved;
};

const ScenarioOutcome = mongoose.model(
  "ScenarioOutcome",
  scenarioOutcomeSchema
);

module.exports = ScenarioOutcome;

