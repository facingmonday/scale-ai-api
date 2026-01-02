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
  // storeTypePresets-based seeding is deprecated.
  // StoreTypes should be created via API/UI and configured via:
  // - VariableDefinition(appliesTo="storeType", classroomId=null, organization=orgId)
  // - VariableValue(appliesTo="storeType", ownerId=storeTypeId)
  return [];
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
storeTypeSchema.methods.getStoreTypeVariables = async function () {
  await this._loadVariables();
  return this.variables || {};
};

const StoreType = mongoose.model("StoreType", storeTypeSchema);

module.exports = StoreType;
