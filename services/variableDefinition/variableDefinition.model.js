const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

/**
 * @openapi
 * components:
 *   schemas:
 *     VariableDefinition:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The Mongoose ObjectId of the variable definition.
 *         classroomId:
 *           type: string
 *           description: The associated classroom ID.
 *         organization:
 *           type: string
 *           description: The associated organization ID.
 *         key:
 *           type: string
 *           description: Unique variable identifier key.
 *           example: price_elasticity
 *         label:
 *           type: string
 *           description: Human-readable label for the variable.
 *           example: Price Elasticity
 *         description:
 *           type: string
 *           description: Description of the variable's function.
 *         appliesTo:
 *           type: string
 *           enum: [profile, profileType, challenge, decision, outcome]
 *           description: Scope of application.
 *         dataType:
 *           type: string
 *           enum: [number, string, boolean, select]
 *           description: The raw data type of the variable.
 *         inputType:
 *           type: string
 *           enum: [text, number, slider, dropdown, checkbox, knob, selectbutton, switch, multiple-choice]
 *           description: The input field type displayed in the UI.
 *         options:
 *           type: array
 *           items:
 *             type: object
 *           description: List of options for select data types.
 *         defaultValue:
 *           type: object
 *           description: Default value.
 *         min:
 *           type: number
 *           description: Minimum numeric range.
 *         max:
 *           type: number
 *           description: Maximum numeric range.
 *         required:
 *           type: boolean
 *           description: Whether this variable is required to submit decisions/outcomes.
 *         isActive:
 *           type: boolean
 *           description: Soft deletion indicator flag.
 */
const variableDefinitionSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Challenge",
    default: null,
    index: true,
  },
  key: {
    type: String,
    required: true,
    trim: true,
  },
  label: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  appliesTo: {
    type: String,
    enum: ["profile", "profileType", "challenge", "decision", "outcome"],
    required: true,
    index: true,
  },
  dataType: {
    type: String,
    enum: ["number", "string", "boolean", "select"],
    required: true,
  },
  inputType: {
    type: String,
    enum: [
      "text",
      "number",
      "slider",
      "dropdown",
      "checkbox",
      "knob",
      "selectbutton",
      "switch",
      "multiple-choice",
    ],
    default: "text",
  },
  options: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  min: {
    type: Number,
    default: null,
  },
  max: {
    type: Number,
    default: null,
  },
  required: {
    type: Boolean,
    default: false,
  },
  // Soft delete flag
  isActive: {
    type: Boolean,
    default: true,
  },
}).add(baseSchema);

// Compound indexes for performance
// All definitions are classroom-scoped: unique on organization + classroomId + appliesTo + key + challengeId
variableDefinitionSchema.index(
  { organization: 1, classroomId: 1, appliesTo: 1, key: 1, challengeId: 1 },
  {
    unique: true,
    sparse: true, // keep sparse to avoid impacting older docs during transition
  },
);
variableDefinitionSchema.index({ classroomId: 1, appliesTo: 1 });
variableDefinitionSchema.index({ classroomId: 1, isActive: 1 });
variableDefinitionSchema.index({ organization: 1, classroomId: 1 });
variableDefinitionSchema.index({ organization: 1, appliesTo: 1 });

// Static methods - Shared utilities for variable definition operations

/**
 * Create a variable definition
 * @param {string} classroomId - Class ID
 * @param {Object} payload - Variable definition data
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created variable definition
 */
variableDefinitionSchema.statics.createDefinition = async function (
  classroomId,
  payload,
  organizationId,
  clerkUserId,
) {
  if (!classroomId) {
    throw new Error("classroomId is required");
  }

  // Check uniqueness within org + classroom + appliesTo + challengeId
  const existing = await this.findOne({
    organization: organizationId,
    classroomId,
    appliesTo: payload.appliesTo,
    key: payload.key,
    challengeId: payload.challengeId || null,
  });

  if (existing) {
    throw new Error(
      `Variable definition with key "${payload.key}" already exists for this class`,
    );
  }

  // Validate dataType and inputType compatibility
  const validCombinations = {
    number: ["number", "slider", "knob"],
    string: ["text", "dropdown", "selectbutton", "multiple-choice"],
    boolean: ["checkbox"],
    select: ["dropdown"],
  };

  if (
    payload.inputType &&
    validCombinations[payload.dataType] &&
    !validCombinations[payload.dataType].includes(payload.inputType)
  ) {
    throw new Error(
      `Invalid inputType "${payload.inputType}" for dataType "${payload.dataType}"`,
    );
  }

  // Validate options for select/dropdown
  if (
    (payload.dataType === "select" || payload.inputType === "dropdown") &&
    (!payload.options || payload.options.length === 0)
  ) {
    throw new Error("Options are required for select/dropdown type");
  }

  // Set default inputType based on dataType if not provided
  if (!payload.inputType) {
    switch (payload.dataType) {
      case "number":
        payload.inputType = "number";
        break;
      case "boolean":
        payload.inputType = "checkbox";
        break;
      case "select":
        payload.inputType = "dropdown";
        break;
      default:
        payload.inputType = "text";
    }
  }

  const definition = new this({
    classroomId,
    challengeId: payload.challengeId || null,
    key: payload.key,
    label: payload.label,
    description: payload.description || "",
    appliesTo: payload.appliesTo,
    dataType: payload.dataType,
    inputType: payload.inputType,
    options: payload.options || [],
    defaultValue:
      payload.defaultValue !== undefined ? payload.defaultValue : null,
    min: payload.min !== undefined ? payload.min : null,
    max: payload.max !== undefined ? payload.max : null,
    required: payload.required !== undefined ? payload.required : false,
    isActive: true,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await definition.save();
  return definition;
};

/**
 * Get variable definitions for a specific scope
 * @param {string} classroomId - Class ID
 * @param {string} appliesTo - Scope ("profile", "challenge", "decision", "profileType")
 * @param {Object} options - Options (includeInactive)
 * @returns {Promise<Array>} Array of variable definitions
 */
variableDefinitionSchema.statics.getDefinitionsForScope = async function (
  classroomId,
  appliesTo,
  options = {},
) {
  const query = { appliesTo };
  if (!classroomId) {
    throw new Error("classroomId is required");
  }
  query.classroomId = classroomId;

  if (!options.includeInactive) {
    query.isActive = true;
  } else {
    delete query.isActive;
  }

  if (options.challengeId) {
    query.$or = [
      { challengeId: null },
      { challengeId: options.challengeId }
    ];
  } else {
    query.challengeId = null;
  }

  const definitions = await this.find(query).sort({ label: 1 });
  return definitions;
};

/**
 * Get all variable definitions for a class
 * @param {string} classroomId - Class ID
 * @param {Object} options - Options (includeInactive, challengeId)
 * @returns {Promise<Array>} Array of variable definitions
 */
variableDefinitionSchema.statics.getDefinitionsByClass = async function (
  classroomId,
  options = {},
) {
  const query = { classroomId };
  if (!options.includeInactive) {
    query.isActive = true;
  } else {
    delete query.isActive;
  }

  if (options.challengeId) {
    query.$or = [
      { challengeId: null },
      { challengeId: options.challengeId }
    ];
  } else {
    query.challengeId = null;
  }

  const definitions = await this.find(query).sort({ appliesTo: 1, label: 1 });
  return definitions;
};

/**
 * Validate values against definitions
 * @param {string} classroomId - Class ID (required for profile/challenge/decision)
 * @param {string} appliesTo - Scope ("profile", "challenge", "decision", "profileType")
 * @param {Object} valuesObject - Values to validate
 * @param {Object} options - Options (challengeId)
 * @returns {Promise<Object>} Validation result with errors array
 */
variableDefinitionSchema.statics.validateValues = async function (
  classroomId,
  appliesTo,
  valuesObject,
  options = {},
) {
  const definitions = await this.getDefinitionsForScope(classroomId, appliesTo, options);
  const errors = [];

  const activeDefinitions = definitions.filter(
    (definition) => definition.isActive,
  );

  for (const definition of activeDefinitions) {
    const value = valuesObject[definition.key];

    // Check required fields
    if (
      definition.required &&
      (value === undefined || value === null || value === "")
    ) {
      errors.push({
        key: definition.key,
        message: `${definition.label} is required`,
      });
      continue;
    }

    // Skip validation if value is not provided and not required
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // Type validation
    switch (definition.dataType) {
      case "number":
        if (typeof value !== "number" && !Number.isFinite(Number(value))) {
          errors.push({
            key: definition.key,
            message: `${definition.label} must be a number`,
          });
        } else {
          const numValue = Number(value);
          if (definition.min !== null && numValue < definition.min) {
            errors.push({
              key: definition.key,
              message: `${definition.label} must be at least ${definition.min}`,
            });
          }
          if (definition.max !== null && numValue > definition.max) {
            errors.push({
              key: definition.key,
              message: `${definition.label} must be at most ${definition.max}`,
            });
          }
        }
        break;

      case "boolean":
        if (typeof value !== "boolean") {
          errors.push({
            key: definition.key,
            message: `${definition.label} must be a boolean`,
          });
        }
        break;

      case "select":
        // Support both primitive options (["a","b"]) and structured options ([{label,value}])
        // because UI layers often profile select options as objects.
        {
          const rawOptions = Array.isArray(definition.options)
            ? definition.options
            : [];
          const allowedValues = rawOptions
            .map((opt) => {
              if (opt && typeof opt === "object") {
                // Prefer value, fall back to label
                return opt.value !== undefined ? opt.value : opt.label;
              }
              return opt;
            })
            .filter((v) => v !== undefined && v !== null);

          if (!allowedValues.includes(value)) {
            errors.push({
              key: definition.key,
              message: `${definition.label} must be one of: ${allowedValues.join(", ")}`,
            });
          }
        }
        break;

      case "string":
        if (typeof value !== "string") {
          errors.push({
            key: definition.key,
            message: `${definition.label} must be a string`,
          });
        }
        break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Apply default values to an object based on definitions
 * @param {string} classroomId - Class ID (required for profile/challenge/decision)
 * @param {string} appliesTo - Scope ("profile", "challenge", "decision", "profileType")
 * @param {Object} valuesObject - Values object to apply defaults to
 * @param {Object} options - Options (challengeId)
 * @returns {Promise<Object>} Values object with defaults applied
 */
variableDefinitionSchema.statics.applyDefaults = async function (
  classroomId,
  appliesTo,
  valuesObject,
  options = {},
) {
  const definitions = await this.getDefinitionsForScope(classroomId, appliesTo, options);
  const result = { ...valuesObject };

  for (const definition of definitions) {
    // Only apply default if value is not already set
    if (
      result[definition.key] === undefined ||
      result[definition.key] === null ||
      result[definition.key] === ""
    ) {
      if (
        definition.defaultValue !== null &&
        definition.defaultValue !== undefined
      ) {
        result[definition.key] = definition.defaultValue;
      }
    }
  }

  return result;
};

/**
 * Filter a variables object to only include keys with active definitions.
 * Used for AI ledger calculations so inactive (soft-deleted) variables
 * are excluded from the calculation context.
 *
 * @param {string} classroomId - Classroom ID
 * @param {string} appliesTo - "profile", "profileType", "challenge", or "decision"
 * @param {Object} variables - { [key]: value }
 * @param {Object} options - Options (challengeId)
 * @returns {Promise<Object>} Filtered variables (only keys with active definitions)
 */
variableDefinitionSchema.statics.filterVariablesByActiveDefinitions =
  async function (classroomId, appliesTo, variables, options = {}) {
    if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
      return {};
    }
    const definitions = await this.getDefinitionsForScope(classroomId, appliesTo, options);
    const activeKeys = new Set(definitions.map((d) => d.key));
    const filtered = {};
    for (const [key, value] of Object.entries(variables)) {
      if (activeKeys.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  };

/**
 * Filter all variable collections for AI simulation context.
 * Profile variables are filtered by both "profile" and "profileType" (union of active keys).
 *
 * @param {string} classroomId - Classroom ID
 * @param {Object} ctx - { profileVariables, challengeVariables, decisionVariables, outcomeVariables }
 * @param {Object} options - Options (challengeId)
 * @returns {Promise<Object>} Filtered context with same shape
 */
variableDefinitionSchema.statics.filterVariablesForAIContext = async function (
  classroomId,
  ctx,
  options = {}
) {
  if (!classroomId) {
    return ctx;
  }
  const [profileDefs, profileTypeDefs, challengeDefs, decisionDefs, outcomeDefs] =
    await Promise.all([
      this.getDefinitionsForScope(classroomId, "profile"),
      this.getDefinitionsForScope(classroomId, "profileType"),
      this.getDefinitionsForScope(classroomId, "challenge", options),
      this.getDefinitionsForScope(classroomId, "decision", options),
      this.getDefinitionsForScope(classroomId, "outcome", options),
    ]);
  const profileActiveKeys = new Set([
    ...profileDefs.map((d) => d.key),
    ...profileTypeDefs.map((d) => d.key),
  ]);
  const challengeActiveKeys = new Set(challengeDefs.map((d) => d.key));
  const decisionActiveKeys = new Set(decisionDefs.map((d) => d.key));
  const outcomeActiveKeys = new Set(outcomeDefs.map((d) => d.key));

  const filterByKeys = (obj, keys) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (keys.has(k)) out[k] = v;
    }
    return out;
  };

  return {
    profileVariables: filterByKeys(ctx.profileVariables, profileActiveKeys),
    challengeVariables: filterByKeys(ctx.challengeVariables, challengeActiveKeys),
    decisionVariables: filterByKeys(ctx.decisionVariables, decisionActiveKeys),
    outcomeVariables: filterByKeys(ctx.outcomeVariables, outcomeActiveKeys),
  };
};

/**
 * Get variable definition by key
 * @param {string} classroomId - Class ID
 * @param {string} key - Variable key
 * @param {Object} options - Options (appliesTo)
 * @returns {Promise<Object|null>} Variable definition or null
 */
variableDefinitionSchema.statics.getDefinitionByKey = async function (
  classroomId,
  key,
  options = {},
) {
  const query = { key, isActive: true };
  if (!classroomId) {
    throw new Error("classroomId is required");
  }
  query.classroomId = classroomId;
  if (options.appliesTo) {
    query.appliesTo = options.appliesTo;
  }

  if (options.challengeId) {
    query.challengeId = options.challengeId;
  } else {
    query.challengeId = null;
  }

  return await this.findOne(query);
};

// Instance methods

/**
 * Soft delete this definition
 * @returns {Promise<Object>} Updated definition
 */
variableDefinitionSchema.methods.softDelete = async function () {
  this.isActive = false;
  this.updatedBy = this.updatedBy || this.createdBy;
  await this.save();
  return this;
};

/**
 * Restore this definition
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated definition
 */
variableDefinitionSchema.methods.restore = async function (clerkUserId) {
  this.isActive = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Check if definition is in use (has values stored)
 * This is a placeholder - actual implementation would check Profile/Decision/Challenge models
 * @returns {Promise<boolean>} True if in use
 */
variableDefinitionSchema.methods.isInUse = async function () {
  // TODO: Check if any Profile/Decision/Challenge has values for this variable
  // For now, return false to allow deletion
  return false;
};

const VariableDefinition = mongoose.model(
  "VariableDefinition",
  variableDefinitionSchema,
);

module.exports = VariableDefinition;
