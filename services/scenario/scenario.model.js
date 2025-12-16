const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");

const scenarioSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  week: {
    type: Number,
    required: true,
    min: 1,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  variables: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  isClosed: {
    type: Boolean,
    default: false,
  },
}).add(baseSchema);

// Compound indexes for performance
scenarioSchema.index({ classId: 1, week: 1 }, { unique: true });
scenarioSchema.index({ classId: 1, isPublished: 1, isClosed: 1 });
scenarioSchema.index({ classId: 1, createdDate: -1 });
scenarioSchema.index({ organization: 1, classId: 1 });

// Static methods - Shared utilities for scenario operations

/**
 * Get next week number for a class
 * @param {string} classId - Class ID
 * @returns {Promise<number>} Next week number
 */
scenarioSchema.statics.getNextWeekNumber = async function (classId) {
  const lastScenario = await this.findOne({ classId })
    .sort({ week: -1 })
    .limit(1);

  if (!lastScenario) {
    return 1;
  }

  return lastScenario.week + 1;
};

/**
 * Validate scenario variables against VariableDefinition
 * @param {string} classId - Class ID
 * @param {Object} variables - Variables object to validate
 * @returns {Promise<Object>} Validation result
 */
scenarioSchema.statics.validateScenarioVariables = async function (
  classId,
  variables
) {
  return await VariableDefinition.validateValues(
    classId,
    "scenario",
    variables
  );
};

/**
 * Create a scenario
 * @param {string} classId - Class ID
 * @param {Object} scenarioData - Scenario data (title, description, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created scenario
 */
scenarioSchema.statics.createScenario = async function (
  classId,
  scenarioData,
  organizationId,
  clerkUserId
) {
  // Get next week number
  const week = await this.getNextWeekNumber(classId);

  // Validate variables if provided
  if (scenarioData.variables && Object.keys(scenarioData.variables).length > 0) {
    const validation = await this.validateScenarioVariables(
      classId,
      scenarioData.variables
    );

    if (!validation.isValid) {
      throw new Error(
        `Invalid scenario variables: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }

    // Apply defaults
    scenarioData.variables = await VariableDefinition.applyDefaults(
      classId,
      "scenario",
      scenarioData.variables
    );
  }

  const scenario = new this({
    classId,
    week,
    title: scenarioData.title,
    description: scenarioData.description || "",
    variables: scenarioData.variables || {},
    isPublished: false,
    isClosed: false,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await scenario.save();
  return scenario;
};

/**
 * Get active scenario (published and not closed)
 * @param {string} classId - Class ID
 * @returns {Promise<Object|null>} Active scenario or null
 */
scenarioSchema.statics.getActiveScenario = async function (classId) {
  return await this.findOne({
    classId,
    isPublished: true,
    isClosed: false,
  }).sort({ week: -1 });
};

/**
 * Get all scenarios for a class
 * @param {string} classId - Class ID
 * @param {Object} options - Options (includeClosed)
 * @returns {Promise<Array>} Array of scenarios
 */
scenarioSchema.statics.getScenariosByClass = async function (
  classId,
  options = {}
) {
  const query = { classId };
  if (!options.includeClosed) {
    query.isClosed = false;
  }

  return await this.find(query).sort({ week: 1 });
};

/**
 * Get scenario by ID with class validation
 * @param {string} scenarioId - Scenario ID
 * @param {string} organizationId - Organization ID (optional, for validation)
 * @returns {Promise<Object|null>} Scenario or null
 */
scenarioSchema.statics.getScenarioById = async function (
  scenarioId,
  organizationId = null
) {
  const query = { _id: scenarioId };
  if (organizationId) {
    query.organization = organizationId;
  }

  return await this.findOne(query);
};

// Instance methods

/**
 * Publish this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.publish = async function (clerkUserId) {
  // Check if there's already an active published scenario
  const activeScenario = await this.constructor.getActiveScenario(this.classId);
  if (activeScenario && activeScenario._id.toString() !== this._id.toString()) {
    throw new Error("Another scenario is already published and active");
  }

  this.isPublished = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Close this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.close = async function (clerkUserId) {
  this.isClosed = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Check if scenario can be edited
 * @returns {boolean} True if can be edited
 */
scenarioSchema.methods.canEdit = function () {
  // Can edit if not published or not closed
  return !this.isPublished || !this.isClosed;
};

/**
 * Check if scenario can be published
 * @returns {Promise<boolean>} True if can be published
 */
scenarioSchema.methods.canPublish = async function () {
  // Can publish if not already published and not closed
  if (this.isPublished || this.isClosed) {
    return false;
  }

  // Check if another scenario is active
  const activeScenario = await this.constructor.getActiveScenario(this.classId);
  return !activeScenario || activeScenario._id.toString() === this._id.toString();
};

const Scenario = mongoose.model("Scenario", scenarioSchema);

module.exports = Scenario;

