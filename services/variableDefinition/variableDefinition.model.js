const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const variableDefinitionSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: false, // Optional - null for organization-scoped storeType definitions
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
    enum: ["store", "scenario", "submission", "storeType"],
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
// For classroom-scoped definitions: unique on classroomId + key
variableDefinitionSchema.index(
  { classroomId: 1, key: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { classroomId: { $ne: null } },
  }
);
// For organization-scoped storeType definitions: unique on organization + appliesTo + key (where classroomId is null)
variableDefinitionSchema.index(
  { organization: 1, appliesTo: 1, key: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { classroomId: null, appliesTo: "storeType" },
  }
);
variableDefinitionSchema.index({ classroomId: 1, appliesTo: 1 });
variableDefinitionSchema.index({ classroomId: 1, isActive: 1 });
variableDefinitionSchema.index({ organization: 1, classroomId: 1 });
variableDefinitionSchema.index({ organization: 1, appliesTo: 1 }); // For organization-scoped storeType definitions

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
  classroomId, // Can be null for organization-scoped storeType definitions
  payload,
  organizationId,
  clerkUserId
) {
  // Validate classroomId requirement based on appliesTo
  if (payload.appliesTo !== "storeType" && !classroomId) {
    throw new Error(
      "classroomId is required for store, scenario, and submission definitions"
    );
  }

  if (payload.appliesTo === "storeType" && classroomId !== null) {
    throw new Error("classroomId must be null for storeType definitions");
  }

  // Check uniqueness - different logic for organization vs classroom scope
  const existing =
    payload.appliesTo === "storeType"
      ? await this.findOne({
          organization: organizationId,
          appliesTo: "storeType",
          classroomId: null,
          key: payload.key,
        })
      : await this.findOne({
          classroomId,
          key: payload.key,
        });

  if (existing) {
    const scope = payload.appliesTo === "storeType" ? "organization" : "class";
    throw new Error(
      `Variable definition with key "${payload.key}" already exists for this ${scope}`
    );
  }

  // Validate dataType and inputType compatibility
  const validCombinations = {
    number: ["number", "slider"],
    string: ["text", "dropdown"],
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
    classroomId: payload.appliesTo === "storeType" ? null : classroomId,
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
 * @param {string|null} classroomId - Class ID (null for organization-scoped storeType definitions)
 * @param {string} appliesTo - Scope ("store", "scenario", "submission", "storeType")
 * @param {Object} options - Options (includeInactive, organizationId for storeType)
 * @returns {Promise<Array>} Array of variable definitions
 */
variableDefinitionSchema.statics.getDefinitionsForScope = async function (
  classroomId, // Can be null for storeType
  appliesTo,
  options = {}
) {
  const query = { appliesTo, isActive: true };

  if (appliesTo === "storeType") {
    // For storeType, query by organization and null classroomId
    if (!options.organizationId) {
      throw new Error("organizationId is required for storeType definitions");
    }
    query.organization = options.organizationId;
    query.classroomId = null;
  } else {
    // For other scopes, require classroomId
    if (!classroomId) {
      throw new Error(
        "classroomId is required for store, scenario, and submission definitions"
      );
    }
    query.classroomId = classroomId;
  }

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
 * @param {string} classroomId - Class ID (required for store/scenario/submission)
 * @param {string} appliesTo - Scope ("store", "scenario", "submission")
 * @param {Object} valuesObject - Values to validate
 * @returns {Promise<Object>} Validation result with errors array
 * @note This method is for classroom-scoped entities only, not storeType
 */
variableDefinitionSchema.statics.validateValues = async function (
  classroomId,
  appliesTo,
  valuesObject
) {
  if (appliesTo === "storeType") {
    throw new Error(
      "validateValues is not supported for storeType. Use organization-scoped validation instead."
    );
  }
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
        if (!definition.options.includes(value)) {
          errors.push({
            key: definition.key,
            message: `${definition.label} must be one of: ${definition.options.join(", ")}`,
          });
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
 * @param {string} classroomId - Class ID (required for store/scenario/submission)
 * @param {string} appliesTo - Scope ("store", "scenario", "submission")
 * @param {Object} valuesObject - Values object to apply defaults to
 * @returns {Promise<Object>} Values object with defaults applied
 * @note This method is for classroom-scoped entities only, not storeType
 */
variableDefinitionSchema.statics.applyDefaults = async function (
  classroomId,
  appliesTo,
  valuesObject
) {
  if (appliesTo === "storeType") {
    throw new Error(
      "applyDefaults is not supported for storeType. Use organization-scoped defaults instead."
    );
  }
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
 * @param {string|null} classroomId - Class ID (null for organization-scoped storeType definitions)
 * @param {string} key - Variable key
 * @param {Object} options - Options (organizationId for storeType, appliesTo)
 * @returns {Promise<Object|null>} Variable definition or null
 */
variableDefinitionSchema.statics.getDefinitionByKey = async function (
  classroomId, // Can be null for storeType
  key,
  options = {}
) {
  const query = { key, isActive: true };

  if (options.appliesTo === "storeType") {
    if (!options.organizationId) {
      throw new Error("organizationId is required for storeType definitions");
    }
    query.organization = options.organizationId;
    query.appliesTo = "storeType";
    query.classroomId = null;
  } else {
    if (!classroomId) {
      throw new Error(
        "classroomId is required for store, scenario, and submission definitions"
      );
    }
    query.classroomId = classroomId;
    if (options.appliesTo) {
      query.appliesTo = options.appliesTo;
    }
  }

  return await this.findOne(query);
};

/**
 * Get variable definitions for organization-scoped storeType
 * @param {string} organizationId - Organization ID
 * @param {Object} options - Options (includeInactive)
 * @returns {Promise<Array>} Array of variable definitions
 */
variableDefinitionSchema.statics.getStoreTypeDefinitions = async function (
  organizationId,
  options = {}
) {
  const query = {
    organization: organizationId,
    appliesTo: "storeType",
    classroomId: null,
    isActive: true,
  };
  if (options.includeInactive) {
    delete query.isActive;
  }

  const definitions = await this.find(query).sort({ label: 1 });
  return definitions;
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
