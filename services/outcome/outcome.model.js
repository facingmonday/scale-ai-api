const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const LedgerEntry = require("../ledger/ledger.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");
/**
 * @openapi
 * components:
 *   schemas:
 *     Outcome:
 *       type: object
 *       required:
 *         - challengeId
 *       properties:
 *         _id:
 *           type: string
 *         classroomId:
 *           type: string
 *         challengeId:
 *           type: string
 *         notes:
 *           type: string
 *         hiddenNotes:
 *           type: string
 *         randomEventChancePercent:
 *           type: number
 *         autoGenerateSubmissionsOnOutcome:
 *           type: string
 *           enum: [USE_AI, FORWARD_PREVIOUS, USE_DEFAULTS, SKIP]
 *         punishAbsentStudents:
 *           type: string
 *           enum: [high, medium, low, none]
 *         variables:
 *           type: object
 *           description: Map of resolved outcome variable values.
 */
const scenarioOutcomeSchema = new mongoose.Schema({
  // classroomId is denormalized onto the outcome so the variablePopulationPlugin
  // can look up active VariableDefinitions without an extra Challenge join.
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: false,
    index: true,
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Challenge",
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
  // Probability (0-100) that a random event will occur for this challenge outcome.
  // Default 0 means random events are disabled.
  randomEventChancePercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  // Auto-generate decisions for missing students when outcome is set.
  // SKIP intentionally leaves missing students without a ledger entry.
  autoGenerateSubmissionsOnOutcome: {
    type: String,
    enum: ["USE_AI", "FORWARD_PREVIOUS", "USE_DEFAULTS", "SKIP"],
    default: null,
  },
  // Punishment level for absent students when using FORWARD_PREVIOUS
  // Options: "high", "medium", "low", "none", or undefined/null (no punishment)
  punishAbsentStudents: {
    type: String,
    enum: ["high", "medium", "low", "none"],
    default: null,
  },
  approved: {
    type: Boolean,
    default: false,
    index: true,
  },
}).add(baseSchema);

// Indexes for performance
// challengeId already has a unique index from unique: true
scenarioOutcomeSchema.index({ organization: 1, challengeId: 1 });

// Apply the variable population plugin so `outcome.variables` is loaded
// from VariableValue with appliesTo: "outcome".
scenarioOutcomeSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "outcome",
  outputFormat: "valueMap",
});

// Static methods - Shared utilities for challenge outcome operations

/**
 * Create or update challenge outcome
 * @param {string} challengeId - Challenge ID
 * @param {Object} outcomeData - Outcome data
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created or updated outcome
 */
scenarioOutcomeSchema.statics.createOrUpdateOutcome = async function (
  challengeId,
  outcomeData,
  organizationId,
  clerkUserId,
  classroomId = null
) {
  let outcome = await this.findOne({ challengeId });

  const normalizedChancePercent =
    outcomeData.randomEventChancePercent !== undefined
      ? outcomeData.randomEventChancePercent
      : undefined;

  const normalizedAutoGenerate =
    outcomeData.autoGenerateSubmissionsOnOutcome !== undefined
      ? outcomeData.autoGenerateSubmissionsOnOutcome || null
      : undefined;

  const normalizedPunishAbsent =
    outcomeData.punishAbsentStudents !== undefined
      ? outcomeData.punishAbsentStudents || "none"
      : "none";

  const normalizedApproved =
    outcomeData.approved !== undefined
      ? !!outcomeData.approved
      : undefined;

  if (outcome) {
    outcome.notes =
      outcomeData.notes !== undefined ? outcomeData.notes : outcome.notes;
    outcome.hiddenNotes =
      outcomeData.hiddenNotes !== undefined
        ? outcomeData.hiddenNotes
        : outcome.hiddenNotes;
    if (normalizedChancePercent !== undefined) {
      outcome.randomEventChancePercent = normalizedChancePercent;
    }
    if (normalizedAutoGenerate !== undefined) {
      outcome.autoGenerateSubmissionsOnOutcome = normalizedAutoGenerate;
    }
    if (normalizedPunishAbsent !== undefined) {
      outcome.punishAbsentStudents = normalizedPunishAbsent;
    }
    if (normalizedApproved !== undefined) {
      outcome.approved = normalizedApproved;
    }
    if (classroomId && !outcome.classroomId) {
      outcome.classroomId = classroomId;
    }
    outcome.updatedBy = clerkUserId;
    await outcome.save();
  } else {
    outcome = new this({
      challengeId,
      classroomId: classroomId || null,
      notes: outcomeData.notes || "",
      hiddenNotes: outcomeData.hiddenNotes || "",
      randomEventChancePercent:
        normalizedChancePercent !== undefined ? normalizedChancePercent : 0,
      autoGenerateSubmissionsOnOutcome: normalizedAutoGenerate || null,
      punishAbsentStudents: normalizedPunishAbsent || null,
      approved: normalizedApproved !== undefined ? normalizedApproved : false,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    await outcome.save();
  }

  return outcome;
};

/**
 * Update outcome variables (replaces all values for this outcome with the
 * provided map, deleting any keys not present in the payload).
 * @param {string} challengeId
 * @param {Object} variables - { [key]: value }
 * @param {string} organizationId
 * @param {string} clerkUserId
 */
scenarioOutcomeSchema.statics.updateVariables = async function (
  challengeId,
  variables,
  organizationId,
  clerkUserId
) {
  const VariableDefinition = require("../variableDefinition/variableDefinition.model");
  const VariableValue = require("../variableDefinition/variableValue.model");

  const outcome = await this.findOne({ challengeId });
  if (!outcome) {
    throw new Error("Outcome not found");
  }
  if (!outcome.classroomId) {
    throw new Error("Outcome is missing classroomId; cannot save variables");
  }

  const classroomId = outcome.classroomId;
  const filtered =
    await VariableDefinition.filterVariablesByActiveDefinitions(
      classroomId,
      "outcome",
      variables || {}
    );

  const validation = await VariableDefinition.validateValues(
    classroomId,
    "outcome",
    filtered
  );
  if (!validation.isValid) {
    const err = new Error("Validation failed");
    err.details = validation.errors;
    throw err;
  }

  const withDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    "outcome",
    filtered
  );

  // Upsert each provided value, then delete any keys that are not in the payload.
  const keysToKeep = new Set(Object.keys(withDefaults));
  for (const [key, value] of Object.entries(withDefaults)) {
    await VariableValue.setVariable(
      classroomId,
      "outcome",
      outcome._id,
      key,
      value,
      organizationId,
      clerkUserId
    );
  }
  await VariableValue.deleteMany({
    classroomId,
    appliesTo: "outcome",
    ownerId: outcome._id,
    variableKey: { $nin: Array.from(keysToKeep) },
  });

  return outcome;
};

/**
 * Get outcome by challenge ID
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<Object|null>} Outcome or null
 */
scenarioOutcomeSchema.statics.getOutcomeByScenario = async function (
  challengeId
) {
  return await this.findOne({ challengeId });
};

/**
 * Delete outcome by challenge ID
 * Also deletes all related ledger entries for this challenge
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<Object|null>} Deleted outcome or null
 */
scenarioOutcomeSchema.statics.deleteOutcome = async function (challengeId) {
  // Delete all ledger entries for this challenge first
  await LedgerEntry.deleteLedgerEntriesForScenario(challengeId);

  // Then delete the outcome
  return await this.findOneAndDelete({ challengeId });
};

const Outcome = mongoose.model(
  "Outcome",
  scenarioOutcomeSchema
);

module.exports = Outcome;
