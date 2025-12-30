const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const variableDefinitionSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
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
    enum: ["store", "scenario", "submission"],
    required: true,
    index: true,
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    default: null,
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
  affectsCalculation: {
    type: Boolean,
    default: true,
  },
  // Soft delete flag
  isActive: {
    type: Boolean,
    default: true,
  },
}).add(baseSchema);

// Compound indexes for performance
variableDefinitionSchema.index({ classroomId: 1, key: 1 }, { unique: true });
variableDefinitionSchema.index({ classroomId: 1, appliesTo: 1 });
variableDefinitionSchema.index({ classroomId: 1, isActive: 1 });
variableDefinitionSchema.index({ organization: 1, classroomId: 1 });

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
  clerkUserId
) {
  // Check if key already exists for this class
  const existing = await this.findOne({ classroomId, key: payload.key });
  if (existing) {
    throw new Error(
      `Variable definition with key "${payload.key}" already exists for this class`
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
      `Invalid inputType "${payload.inputType}" for dataType "${payload.dataType}"`
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
    affectsCalculation:
      payload.affectsCalculation !== undefined
        ? payload.affectsCalculation
        : true,
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
 * @param {string} appliesTo - Scope ("store", "scenario", "submission")
 * @param {Object} options - Options (includeInactive)
 * @returns {Promise<Array>} Array of variable definitions
 */
variableDefinitionSchema.statics.getDefinitionsForScope = async function (
  classroomId,
  appliesTo,
  options = {}
) {
  const query = { classroomId, appliesTo, isActive: true };
  if (options.includeInactive) {
    delete query.isActive;
  }

  const definitions = await this.find(query).sort({ label: 1 });
  return definitions;
};

/**
 * Get all variable definitions for a class
 * @param {string} classroomId - Class ID
 * @param {Object} options - Options (includeInactive)
 * @returns {Promise<Array>} Array of variable definitions
 */
variableDefinitionSchema.statics.getDefinitionsByClass = async function (
  classroomId,
  options = {}
) {
  const query = { classroomId, isActive: true };
  if (options.includeInactive) {
    delete query.isActive;
  }

  const definitions = await this.find(query).sort({ appliesTo: 1, label: 1 });
  return definitions;
};

/**
 * Validate values against definitions
 * @param {string} classroomId - Class ID
 * @param {string} appliesTo - Scope ("store", "scenario", "submission")
 * @param {Object} valuesObject - Values to validate
 * @returns {Promise<Object>} Validation result with errors array
 */
variableDefinitionSchema.statics.validateValues = async function (
  classroomId,
  appliesTo,
  valuesObject
) {
  const definitions = await this.getDefinitionsForScope(classroomId, appliesTo);
  const errors = [];

  for (const definition of definitions) {
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
        // because UI layers often store select options as objects.
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
 * @param {string} classroomId - Class ID
 * @param {string} appliesTo - Scope ("store", "scenario", "submission")
 * @param {Object} valuesObject - Values object to apply defaults to
 * @returns {Promise<Object>} Values object with defaults applied
 */
variableDefinitionSchema.statics.applyDefaults = async function (
  classroomId,
  appliesTo,
  valuesObject
) {
  const definitions = await this.getDefinitionsForScope(classroomId, appliesTo);
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
 * Get variable definition by key
 * @param {string} classroomId - Class ID
 * @param {string} key - Variable key
 * @returns {Promise<Object|null>} Variable definition or null
 */
variableDefinitionSchema.statics.getDefinitionByKey = async function (
  classroomId,
  key
) {
  return await this.findOne({ classroomId, key, isActive: true });
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
 * This is a placeholder - actual implementation would check Store/Submission/Scenario models
 * @returns {Promise<boolean>} True if in use
 */
variableDefinitionSchema.methods.isInUse = async function () {
  // TODO: Check if any Store/Submission/Scenario has values for this variable
  // For now, return false to allow deletion
  return false;
};

const VariableDefinition = mongoose.model(
  "VariableDefinition",
  variableDefinitionSchema
);

module.exports = VariableDefinition;
