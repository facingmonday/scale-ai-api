const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableValue = require("../variableDefinition/variableValue.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");

const storeTypeSchema = new mongoose.Schema({
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
  // Soft delete flag
  isActive: {
    type: Boolean,
    default: true,
  },
}).add(baseSchema);

// Apply variable population plugin
// Note: storeType is organization-scoped (no classroomId)
// The plugin expects classroomId, so we'll override _loadVariables after plugin loads
storeTypeSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "storeType",
  outputFormat: "valueMap",
});

// Override _loadVariables and _getCachedVariables after plugin is applied
// Since storeType doesn't have classroomId, load values directly
// We need to override both to work with the plugin's cache mechanism
const originalGetCachedVariables = storeTypeSchema.methods._getCachedVariables;
storeTypeSchema.methods._loadVariables = async function () {
  // Since storeType is organization-scoped (no classroomId),
  // load values directly from VariableValue
  const variables = await VariableValue.find({
    appliesTo: "storeType",
    ownerId: this._id,
  });

  // Also fetch organization-scoped definitions for structure
  const definitions = await VariableDefinition.find({
    organization: this.organization,
    appliesTo: "storeType",
    classroomId: null,
    isActive: true,
  });

  // Create a map of values by key
  const variablesMap = {};
  (variables || []).forEach((v) => {
    variablesMap[v.variableKey] = v.value;
  });

  // Include all definition keys, even if they don't have values yet
  // This ensures the variables object has all expected keys
  definitions.forEach((def) => {
    if (variablesMap[def.key] === undefined) {
      variablesMap[def.key] = null;
    }
  });

  // Store on instance so _getCachedVariables can access it
  this._storeTypeVariables = variablesMap;

  return variablesMap;
};

// Override _getCachedVariables to use our cached variables
storeTypeSchema.methods._getCachedVariables = function () {
  // If we have our cached variables, return them
  if (this._storeTypeVariables) {
    return this._storeTypeVariables;
  }
  // Otherwise fall back to plugin's cache (which will be empty for storeType)
  return originalGetCachedVariables
    ? originalGetCachedVariables.call(this)
    : {};
};

// Compound indexes for performance
storeTypeSchema.index({ organization: 1, key: 1 }, { unique: true });
storeTypeSchema.index({ organization: 1, isActive: 1 });
storeTypeSchema.index({ organization: 1 });

// Static methods

/**
 * Create a store type
 * @param {string} organizationId - Organization ID
 * @param {Object} payload - Store type data (key, label, description, variables)
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created store type
 */
storeTypeSchema.statics.createStoreType = async function (
  organizationId,
  payload,
  clerkUserId
) {
  // Check if key already exists for this organization
  const existing = await this.findOne({
    organization: organizationId,
    key: payload.key,
  });
  if (existing) {
    throw new Error(
      `Store type with key "${payload.key}" already exists for this organization`
    );
  }

  const { variables, ...storeTypeFields } = payload;

  const storeType = new this({
    organization: organizationId,
    key: storeTypeFields.key,
    label: storeTypeFields.label,
    description: storeTypeFields.description || "",
    isActive: true,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await storeType.save();

  // Create variable values if provided
  if (variables && typeof variables === "object") {
    const variableEntries = Object.entries(variables);
    for (const [variableKey, value] of variableEntries) {
      await VariableValue.setVariable(
        "storeType",
        storeType._id,
        variableKey,
        value,
        organizationId,
        clerkUserId
      );
    }
  }

  // Load variables before returning
  await storeType._loadVariables();
  return storeType.toObject();
};

/**
 * Get all active store types for an organization
 * @param {string} organizationId - Organization ID
 * @param {Object} options - Options (includeInactive)
 * @returns {Promise<Array>} Array of store types with variables
 */
storeTypeSchema.statics.getStoreTypesByOrganization = async function (
  organizationId,
  options = {}
) {
  const query = { organization: organizationId, isActive: true };
  if (options.includeInactive) {
    delete query.isActive;
  }

  const storeTypes = await this.find(query).sort({ label: 1 });

  // Load variables for all store types (organization-scoped, so we do it manually)
  if (storeTypes.length > 0) {
    const storeTypeIds = storeTypes.map((st) => st._id);
    const allVariables = await VariableValue.find({
      appliesTo: "storeType",
      ownerId: { $in: storeTypeIds },
    });

    // Group variables by ownerId
    const variablesByOwner = {};
    allVariables.forEach((v) => {
      const ownerId = v.ownerId.toString();
      if (!variablesByOwner[ownerId]) {
        variablesByOwner[ownerId] = {};
      }
      variablesByOwner[ownerId][v.variableKey] = v.value;
    });

    // Assign variables to each store type
    storeTypes.forEach((storeType) => {
      const ownerId = storeType._id.toString();
      storeType._storeTypeVariables = variablesByOwner[ownerId] || {};
    });
  }

  return storeTypes.map((storeType) => storeType.toObject());
};

/**
 * Get store type by key for an organization
 * @param {string} organizationId - Organization ID
 * @param {string} key - Store type key
 * @returns {Promise<Object|null>} Store type or null
 */
storeTypeSchema.statics.getStoreTypeByKey = async function (
  organizationId,
  key
) {
  return await this.findOne({
    organization: organizationId,
    key,
    isActive: true,
  });
};

/**
 * Get store type by ID (checks organization)
 * @param {string} organizationId - Organization ID
 * @param {string} storeTypeId - Store type ID
 * @returns {Promise<Object|null>} Store type or null
 */
storeTypeSchema.statics.getStoreTypeById = async function (
  organizationId,
  storeTypeId
) {
  return await this.findOne({
    _id: storeTypeId,
    organization: organizationId,
    isActive: true,
  });
};

/**
 * Seed default store types for an organization
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Array>} Array of created store types
 */
storeTypeSchema.statics.seedDefaultStoreTypes = async function (
  organizationId,
  clerkUserId
) {
  const defaultStoreTypes =
    require("../store/storeTypePresets").STORE_TYPE_PRESETS;
  const createdStoreTypes = [];

  // First, seed variable definitions for storeType variables
  // Extract all unique variable keys from all presets
  const allVariableKeys = new Set();
  Object.values(defaultStoreTypes).forEach((preset) => {
    Object.keys(preset).forEach((key) => {
      // Exclude label and description (they're storeType fields, not variables)
      if (key !== "label" && key !== "description") {
        allVariableKeys.add(key);
      }
    });
  });

  // Create variable definitions for each key
  for (const variableKey of allVariableKeys) {
    const existingDef = await VariableDefinition.findOne({
      organization: organizationId,
      appliesTo: "storeType",
      classroomId: null,
      key: variableKey,
    });

    if (!existingDef) {
      // Infer dataType from first preset value that has this key
      const sampleValue = Object.values(defaultStoreTypes).find(
        (p) => p[variableKey] !== undefined
      )?.[variableKey];

      let dataType = "string";
      let inputType = "text";
      let options = [];

      if (typeof sampleValue === "number") {
        dataType = "number";
        inputType = "number";
      } else if (typeof sampleValue === "boolean") {
        dataType = "boolean";
        inputType = "checkbox";
      } else if (Array.isArray(sampleValue)) {
        dataType = "select";
        inputType = "dropdown";
        // Extract unique options from all presets that have this key
        const allOptions = new Set();
        Object.values(defaultStoreTypes).forEach((p) => {
          if (Array.isArray(p[variableKey])) {
            p[variableKey].forEach((opt) => allOptions.add(opt));
          } else if (p[variableKey] !== undefined) {
            allOptions.add(p[variableKey]);
          }
        });
        options = Array.from(allOptions);
      } else if (typeof sampleValue === "string") {
        // Check if it's a select-like field (limited set of values)
        const uniqueValues = new Set();
        Object.values(defaultStoreTypes).forEach((p) => {
          if (p[variableKey] !== undefined) {
            uniqueValues.add(p[variableKey]);
          }
        });
        // If there are 10 or fewer unique values, treat as select
        if (uniqueValues.size <= 10 && uniqueValues.size > 1) {
          dataType = "select";
          inputType = "dropdown";
          options = Array.from(uniqueValues);
        } else {
          dataType = "string";
          inputType = "text";
        }
      }

      // Create a human-readable label from the key
      const label = variableKey
        .replace(/([A-Z])/g, " $1") // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
        .trim();

      try {
        await VariableDefinition.createDefinition(
          null, // classroomId is null for storeType
          {
            key: variableKey,
            label,
            description: `Default variable for store types: ${variableKey}`,
            appliesTo: "storeType",
            dataType,
            inputType,
            options: options.length > 0 ? options : [],
            defaultValue: null,
            required: false,
            affectsCalculation: true,
          },
          organizationId,
          clerkUserId
        );
      } catch (error) {
        // Log but continue - definition might already exist from concurrent seeding
        console.warn(
          `Warning: Could not create variable definition for ${variableKey}:`,
          error.message
        );
      }
    }
  }

  // Then seed store types themselves
  for (const [key, preset] of Object.entries(defaultStoreTypes)) {
    // Check if store type already exists
    const existing = await this.findOne({
      organization: organizationId,
      key,
    });

    if (!existing) {
      // Extract label and description, rest goes to variables
      const { label, description, ...variables } = preset;

      const storeType = await this.createStoreType(
        organizationId,
        {
          key,
          label,
          description,
          variables, // All other preset fields become variables
        },
        clerkUserId
      );

      createdStoreTypes.push(storeType);
    }
  }

  return createdStoreTypes;
};

// Instance methods

/**
 * Soft delete this store type
 * @returns {Promise<Object>} Updated store type
 */
storeTypeSchema.methods.softDelete = async function () {
  this.isActive = false;
  this.updatedBy = this.updatedBy || this.createdBy;
  await this.save();
  return this;
};

/**
 * Restore this store type
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated store type
 */
storeTypeSchema.methods.restore = async function (clerkUserId) {
  this.isActive = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Get preset variables for this store type
 * @returns {Promise<Object>} Preset variables object (from variables)
 */
storeTypeSchema.methods.getPresetVariables = async function () {
  await this._loadVariables();
  return this.variables || {};
};

const StoreType = mongoose.model("StoreType", storeTypeSchema);

module.exports = StoreType;
