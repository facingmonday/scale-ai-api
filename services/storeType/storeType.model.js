const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableValue = require("../variableDefinition/variableValue.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");

const storeTypeSchema = new mongoose.Schema({
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
  startingBalance: {
    type: Number,
    default: 0,
  },
  initialStartupCost: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}).add(baseSchema);

// Apply variable population plugin
storeTypeSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "storeType",
  outputFormat: "valueMap",
});

// Compound indexes for performance
storeTypeSchema.index(
  { organization: 1, classroomId: 1, key: 1 },
  { unique: true }
);
storeTypeSchema.index({ organization: 1, classroomId: 1, isActive: 1 });
storeTypeSchema.index({ organization: 1, classroomId: 1 });

// Static methods

/**
 * Create a store type
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {Object} payload - Store type data (key, label, description, variables)
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created store type
 */
storeTypeSchema.statics.createStoreType = async function (
  classroomId,
  organizationId,
  payload,
  clerkUserId
) {
  if (!classroomId) {
    throw new Error("classroomId is required");
  }
  // Check if key already exists for this organization
  const existing = await this.findOne({
    organization: organizationId,
    classroomId,
    key: payload.key,
  });
  if (existing) {
    throw new Error(
      `Store type with key "${payload.key}" already exists for this class`
    );
  }

  const { variables, ...storeTypeFields } = payload;

  const storeType = new this({
    organization: organizationId,
    classroomId,
    key: storeTypeFields.key,
    label: storeTypeFields.label,
    description: storeTypeFields.description || "",
    startingBalance:
      storeTypeFields.startingBalance !== undefined &&
      storeTypeFields.startingBalance !== null
        ? Number(storeTypeFields.startingBalance)
        : 0,
    initialStartupCost:
      storeTypeFields.initialStartupCost !== undefined &&
      storeTypeFields.initialStartupCost !== null
        ? Number(storeTypeFields.initialStartupCost)
        : 0,
    isActive: true,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await storeType.save();

  // Persist storeType variable values (classroom-scoped)
  if (variables && typeof variables === "object") {
    const variableEntries = Object.entries(variables);
    for (const [variableKey, value] of variableEntries) {
      await VariableValue.setVariable(
        classroomId,
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
 * Get all active store types for a classroom
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {Object} options - Options (includeInactive)
 * @returns {Promise<Array>} Array of store types with variables
 */
storeTypeSchema.statics.getStoreTypesByClassroom = async function (
  classroomId,
  organizationId,
  options = {}
) {
  if (!classroomId) {
    throw new Error("classroomId is required");
  }
  const query = { organization: organizationId, classroomId, isActive: true };
  if (options.includeInactive) {
    delete query.isActive;
  }

  const storeTypes = await this.find(query).sort({ label: 1 });
  // Use the variablePopulationPlugin's efficient batch population so `toObject()`
  // includes `variables` (valueMap).
  await this.populateVariablesForMany(storeTypes);

  return storeTypes.map((storeType) => storeType.toObject());
};

/**
 * Get store type by key for a classroom
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {string} key - Store type key
 * @returns {Promise<Object|null>} Store type or null
 */
storeTypeSchema.statics.getStoreTypeByKey = async function (
  classroomId,
  organizationId,
  key
) {
  return await this.findOne({
    organization: organizationId,
    classroomId,
    key,
    isActive: true,
  });
};

/**
 * Get store type by ID (checks organization)
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {string} storeTypeId - Store type ID
 * @returns {Promise<Object|null>} Store type or null
 */
storeTypeSchema.statics.getStoreTypeById = async function (
  classroomId,
  organizationId,
  storeTypeId
) {
  return await this.findOne({
    _id: storeTypeId,
    organization: organizationId,
    classroomId,
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
  // - VariableDefinition(appliesTo="storeType", classroomId=classId, organization=orgId)
  // - VariableValue(appliesTo="storeType", classroomId=classId, ownerId=storeTypeId)
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
