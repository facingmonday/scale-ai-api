const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const ScenarioVariableValue = require("./scenarioVariableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");

const scenarioSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
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

// Configure schema to include virtuals in toObject() and toJSON()
scenarioSchema.set("toObject", { virtuals: true });
scenarioSchema.set("toJSON", { virtuals: true });

// Apply variable population plugin
scenarioSchema.plugin(variablePopulationPlugin, {
  variableValueModel: ScenarioVariableValue,
  foreignKeyField: "scenarioId",
  appliesTo: "scenario",
});

// Compound indexes for performance
scenarioSchema.index({ classroomId: 1, week: 1 }, { unique: true });
scenarioSchema.index({ classroomId: 1, isPublished: 1, isClosed: 1 });
scenarioSchema.index({ classroomId: 1, createdDate: -1 });
scenarioSchema.index({ organization: 1, classroomId: 1 });

// Cache for submission variables (WeakMap keyed by document instance)
const submissionVariablesCache = new WeakMap();

// Virtual for submission variables
scenarioSchema.virtual("submissionVariables").get(function () {
  return submissionVariablesCache.get(this) || [];
});

// Static methods - Shared utilities for scenario operations

/**
 * Get next week number for a class
 * @param {string} classroomId - Class ID
 * @returns {Promise<number>} Next week number
 */
scenarioSchema.statics.getNextWeekNumber = async function (classroomId) {
  const lastScenario = await this.findOne({ classroomId })
    .sort({ week: -1 })
    .limit(1);

  if (!lastScenario) {
    return 1;
  }

  return lastScenario.week + 1;
};

/**
 * Validate scenario variables against VariableDefinition
 * @param {string} classroomId - Class ID
 * @param {Object} variables - Variables object to validate
 * @returns {Promise<Object>} Validation result
 */
scenarioSchema.statics.validateScenarioVariables = async function (
  classroomId,
  variables
) {
  return await VariableDefinition.validateValues(
    classroomId,
    "scenario",
    variables
  );
};

/**
 * Create a scenario
 * @param {string} classroomId - Class ID
 * @param {Object} scenarioData - Scenario data (title, description, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created scenario with variables populated
 */
scenarioSchema.statics.createScenario = async function (
  classroomId,
  scenarioData,
  organizationId,
  clerkUserId
) {
  // Get next week number
  const week = await this.getNextWeekNumber(classroomId);

  // Extract variables from scenarioData
  const { variables, ...scenarioFields } = scenarioData;

  // Validate variables if provided
  if (variables && Object.keys(variables).length > 0) {
    const validation = await this.validateScenarioVariables(
      classroomId,
      variables
    );

    if (!validation.isValid) {
      throw new Error(
        `Invalid scenario variables: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }

    // Apply defaults
    const variablesWithDefaults = await VariableDefinition.applyDefaults(
      classroomId,
      "scenario",
      variables
    );

    // Create scenario document
    const scenario = new this({
      classroomId,
      week,
      title: scenarioFields.title,
      description: scenarioFields.description || "",
      isPublished: false,
      isClosed: false,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await scenario.save();

    // Create variable values if provided
    const variableEntries = Object.entries(variablesWithDefaults);
    const variableDocs = variableEntries.map(([key, value]) => ({
      scenarioId: scenario._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await ScenarioVariableValue.insertMany(variableDocs);
    }

    // Return scenario with variables populated (auto-loaded via plugin)
    const createdScenario = await this.findById(scenario._id);
    return createdScenario ? createdScenario.toObject() : null;
  }

  // No variables provided
  const scenario = new this({
    classroomId,
    week,
    title: scenarioFields.title,
    description: scenarioFields.description || "",
    isPublished: false,
    isClosed: false,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await scenario.save();
  // Explicitly load variables to ensure all definitions are included
  await scenario._loadVariables();
  // Variables are automatically included via plugin
  return scenario.toObject();
};

/**
 * Get active scenario (published and not closed)
 * @param {string} classroomId - Class ID
 * @returns {Promise<Object|null>} Active scenario with variables or null
 */
scenarioSchema.statics.getActiveScenario = async function (classroomId) {
  const scenario = await this.findOne({
    classroomId,
    isPublished: true,
    isClosed: false,
  }).sort({ week: -1 });

  if (!scenario) {
    return null;
  }

  // Explicitly load variables to ensure they're loaded (post-init hook is async and may not complete)
  await scenario._loadVariables();
  // Variables are automatically included via plugin's toObject() override
  return scenario.toObject();
};

/**
 * Get all scenarios for a class
 * @param {string} classroomId - Class ID
 * @param {Object} options - Options (includeClosed)
 * @returns {Promise<Array>} Array of scenarios with variables
 */
scenarioSchema.statics.getScenariosByClass = async function (
  classroomId,
  options = {}
) {
  const query = { classroomId };
  if (!options.includeClosed) {
    query.isClosed = false;
  }

  const scenarios = await this.find(query).sort({ week: 1 });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(scenarios);

  // Variables are automatically included via plugin
  return scenarios.map((scenario) => scenario.toObject());
};

/**
 * Get scenario by ID with class validation
 * @param {string} scenarioId - Scenario ID
 * @param {string} organizationId - Organization ID (optional, for validation)
 * @returns {Promise<Object|null>} Scenario with variables or null
 */
scenarioSchema.statics.getScenarioById = async function (
  scenarioId,
  organizationId = null
) {
  const query = { _id: scenarioId };
  if (organizationId) {
    query.organization = organizationId;
  }

  const scenario = await this.findOne(query);
  if (!scenario) {
    return null;
  }

  // Explicitly load variables to ensure they're cached (post-init hook is async and may not have completed)
  await scenario._loadVariables();

  // Load submission variables (virtual will access cached value)
  await scenario._loadSubmissionVariables();

  // Variables are automatically included via plugin's toObject() override
  // submissionVariables virtual is automatically included via toObject()
  return scenario.toObject();
};

// Instance methods

/**
 * Get variables for this scenario instance
 * Uses cached variables if available, otherwise loads them
 * @returns {Promise<Object>} Variables object
 */
scenarioSchema.methods.getVariables = async function () {
  // Use plugin's cached variables or load them
  return await this._loadVariables();
};

/**
 * Load submission variables for this scenario instance
 * Caches the result for the document instance
 * @returns {Promise<Array>} Array of submission variable definitions
 */
scenarioSchema.methods._loadSubmissionVariables = async function () {
  // Check cache first
  if (submissionVariablesCache.has(this)) {
    return submissionVariablesCache.get(this);
  }

  // Get classroomId from document
  const classroomId = this.classroomId;
  if (!classroomId) {
    const emptyArray = [];
    submissionVariablesCache.set(this, emptyArray);
    return emptyArray;
  }

  // Load submission variable definitions
  const submissionVariables = await VariableDefinition.find({
    classroomId,
    appliesTo: "submission",
    isActive: true,
  }).lean();

  // Cache the result
  submissionVariablesCache.set(this, submissionVariables);

  return submissionVariables;
};

/**
 * Update variables for this scenario
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} Updated variables object
 */
scenarioSchema.methods.updateVariables = async function (
  variables,
  organizationId,
  clerkUserId
) {
  // Validate variables
  const validation = await this.constructor.validateScenarioVariables(
    this.classroomId,
    variables
  );

  if (!validation.isValid) {
    throw new Error(
      `Invalid scenario variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    this.classroomId,
    "scenario",
    variables
  );

  // Update or create variable values
  const variableEntries = Object.entries(variablesWithDefaults);
  for (const [key, value] of variableEntries) {
    await ScenarioVariableValue.setVariable(
      this._id,
      key,
      value,
      organizationId,
      clerkUserId
    );
  }

  // Delete variables that are not in the new set
  const existingVariables = await ScenarioVariableValue.find({
    scenarioId: this._id,
  });
  const newKeys = new Set(Object.keys(variablesWithDefaults));
  for (const existingVar of existingVariables) {
    if (!newKeys.has(existingVar.variableKey)) {
      await ScenarioVariableValue.deleteOne({ _id: existingVar._id });
    }
  }

  // Reload variables to update cache
  await this._loadVariables();

  return variablesWithDefaults;
};

/**
 * Publish this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.publish = async function (clerkUserId) {
  // Check if there's already an active published scenario
  const activeScenario = await this.constructor.getActiveScenario(
    this.classroomId
  );
  if (activeScenario && activeScenario._id.toString() !== this._id.toString()) {
    throw new Error("Another scenario is already published and active");
  }

  this.isPublished = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Unpublish this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.unpublish = async function (clerkUserId) {
  this.isPublished = false;
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
 * Open (re-open) this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.open = async function (clerkUserId) {
  this.isClosed = false;
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
  const activeScenario = await this.constructor.getActiveScenario(
    this.classroomId
  );
  return (
    !activeScenario || activeScenario._id.toString() === this._id.toString()
  );
};

const Scenario = mongoose.model("Scenario", scenarioSchema);

module.exports = Scenario;
