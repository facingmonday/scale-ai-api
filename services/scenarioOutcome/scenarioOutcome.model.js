const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const LedgerEntry = require("../ledger/ledger.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");

const scenarioOutcomeSchema = new mongoose.Schema({
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: true,
    unique: true,
  },
  // Required for variable plugin to load outcome variable definitions/values
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: false,
    index: true,
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
  // Auto-generate submissions for missing students when outcome is set
  // Options: "USE_AI", "FORWARD_PREVIOUS", or undefined/null (no auto-generation)
  autoGenerateSubmissionsOnOutcome: {
    type: String,
    enum: ["USE_AI", "FORWARD_PREVIOUS", "USE_DEFAULTS"],
    default: null,
  },
  // Punishment level for absent students when using FORWARD_PREVIOUS
  // Options: "high", "medium", "low", "none", or undefined/null (no punishment)
  punishAbsentStudents: {
    type: String,
    enum: ["high", "medium", "low", "none"],
    default: null,
  },
}).add(baseSchema);

// Apply variable population plugin so outcome.variables is loaded and serialized
scenarioOutcomeSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "scenarioOutcome",
  outputFormat: "valueMap",
});

// Indexes for performance
// scenarioId already has a unique index from unique: true
scenarioOutcomeSchema.index({ organization: 1, scenarioId: 1 });
scenarioOutcomeSchema.index({ classroomId: 1 });

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

  // Normalize autoGenerateSubmissionsOnOutcome (allow null/undefined to clear)
  const normalizedAutoGenerate =
    outcomeData.autoGenerateSubmissionsOnOutcome !== undefined
      ? outcomeData.autoGenerateSubmissionsOnOutcome || null
      : undefined;

  // Normalize punishAbsentStudents (allow null/undefined to clear)
  const normalizedPunishAbsent =
    outcomeData.punishAbsentStudents !== undefined
      ? outcomeData.punishAbsentStudents || "none"
      : "none";

  if (outcome) {
    // Update existing outcome
    outcome.notes =
      outcomeData.notes !== undefined ? outcomeData.notes : outcome.notes;
    if (normalizedChancePercent !== undefined) {
      outcome.randomEventChancePercent = normalizedChancePercent;
    }
    if (normalizedAutoGenerate !== undefined) {
      outcome.autoGenerateSubmissionsOnOutcome = normalizedAutoGenerate;
    }
    if (normalizedPunishAbsent !== undefined) {
      outcome.punishAbsentStudents = normalizedPunishAbsent;
    }
    if (outcomeData.classroomId !== undefined) {
      outcome.classroomId = outcomeData.classroomId || null;
    }
    outcome.updatedBy = clerkUserId;
    await outcome.save();
  } else {
    // Create new outcome (classroomId required for variable plugin; from scenario)
    outcome = new this({
      scenarioId,
      classroomId: outcomeData.classroomId || null,
      notes: outcomeData.notes || "",
      randomEventChancePercent:
        normalizedChancePercent !== undefined ? normalizedChancePercent : 0,
      autoGenerateSubmissionsOnOutcome: normalizedAutoGenerate || null,
      punishAbsentStudents: normalizedPunishAbsent || null,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    await outcome.save();
  }

  // Handle outcome variables (validate, apply defaults, persist, remove omitted keys)
  if (
    outcomeData.variables !== undefined &&
    outcomeData.variables !== null &&
    typeof outcomeData.variables === "object" &&
    outcome.classroomId
  ) {
    const classroomId = outcome.classroomId;
    const validation = await VariableDefinition.validateValues(
      classroomId,
      "scenarioOutcome",
      outcomeData.variables
    );
    if (!validation.isValid) {
      throw new Error(
        `Invalid scenario outcome variables: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }
    const variablesWithDefaults = await VariableDefinition.applyDefaults(
      classroomId,
      "scenarioOutcome",
      outcomeData.variables
    );
    for (const [key, value] of Object.entries(variablesWithDefaults)) {
      await VariableValue.setVariable(
        classroomId,
        "scenarioOutcome",
        outcome._id,
        key,
        value,
        organizationId,
        clerkUserId
      );
    }
    // Remove variable values no longer in the set
    const existingValues = await VariableValue.find({
      classroomId,
      appliesTo: "scenarioOutcome",
      ownerId: outcome._id,
    });
    const newKeys = new Set(Object.keys(variablesWithDefaults));
    for (const existingVar of existingValues) {
      if (!newKeys.has(existingVar.variableKey)) {
        await VariableValue.deleteOne({ _id: existingVar._id });
      }
    }
    // Reload variables on the document so cache is updated
    if (typeof outcome._loadVariables === "function") {
      await outcome._loadVariables();
    }
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
