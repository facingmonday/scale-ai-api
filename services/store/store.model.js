const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const StoreVariableValue = require("./storeVariableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");

const storeSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  shopName: {
    type: String,
    required: true,
  },
  storeDescription: {
    type: String,
    required: true,
  },
  storeLocation: {
    type: String,
    required: true,
  },
  startingBalance: {
    type: Number,
    default: 0,
  },
}).add(baseSchema);

// Apply variable population plugin
storeSchema.plugin(variablePopulationPlugin, {
  variableValueModel: StoreVariableValue,
  foreignKeyField: "storeId",
  appliesTo: "store",
});

// Compound indexes for performance
storeSchema.index({ classroomId: 1, userId: 1 }, { unique: true });
storeSchema.index({ classroomId: 1 });
storeSchema.index({ userId: 1 });
storeSchema.index({ organization: 1, classroomId: 1 });

// Static methods - Shared utilities for store operations

/**
 * Create a store with variables
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @param {Object} storeData - Store data (shopName, storeDescription, storeLocation, startingBalance, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created store with populated variables
 */
storeSchema.statics.createStore = async function (
  classroomId,
  userId,
  storeData,
  organizationId,
  clerkUserId
) {
  // Check if store already exists
  const existing = await this.findOne({ classroomId, userId });
  if (existing) {
    throw new Error("Store already exists for this user in this class");
  }

  // Extract variables from storeData
  const { variables, ...storeFields } = storeData;

  // Create store document
  const store = new this({
    classroomId,
    userId,
    shopName: storeFields.shopName,
    storeDescription: storeFields.storeDescription,
    storeLocation: storeFields.storeLocation,
    startingBalance: storeFields.startingBalance || 0,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await store.save();

  // Create variable values if provided
  if (variables && typeof variables === "object") {
    const variableEntries = Object.entries(variables);
    const variableDocs = variableEntries.map(([key, value]) => ({
      storeId: store._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await StoreVariableValue.insertMany(variableDocs);
    }
  }

  // Return store with variables populated
  return await this.getStoreByUser(classroomId, userId);
};

/**
 * Get store by user with variables
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Store with variables or null
 */
storeSchema.statics.getStoreByUser = async function (classroomId, userId) {
  const store = await this.findOne({ classroomId, userId });

  if (!store) {
    return null;
  }

  // Explicitly load variables before calling toObject()
  // The post-init hook is async and may not complete before toObject() is called
  await store._loadVariables();

  // Variables are automatically included via plugin's toObject() override
  return store.toObject();
};

/**
 * Check if store exists for user in class
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<boolean>} True if store exists
 */
storeSchema.statics.storeExists = async function (classroomId, userId) {
  const count = await this.countDocuments({ classroomId, userId });
  return count > 0;
};

/**
 * Get store data formatted for AI simulation
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Normalized store data for AI or null
 */
storeSchema.statics.getStoreForSimulation = async function (
  classroomId,
  userId
) {
  const store = await this.getStoreByUser(classroomId, userId);

  if (!store) {
    return null;
  }

  // Return normalized object for AI simulation
  return {
    storeDescription: store.storeDescription,
    storeLocation: store.storeLocation,
    startingBalance: store.startingBalance,
    variables: store.variables || {},
  };
};

/**
 * Get all stores for a class
 * @param {string} classroomId - Class ID
 * @returns {Promise<Array>} Array of stores with variables
 */
storeSchema.statics.getStoresByClass = async function (classroomId) {
  const stores = await this.find({ classroomId });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(stores);

  // Variables are automatically included via plugin
  return stores.map((store) => store.toObject());
};

/**
 * Update a store with variables
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @param {Object} storeData - Store data (shopName, storeDescription, storeLocation, startingBalance, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated store with populated variables
 */
storeSchema.statics.updateStore = async function (
  classroomId,
  userId,
  storeData,
  organizationId,
  clerkUserId
) {
  // Extract variables from storeData
  const { variables, ...storeFields } = storeData;

  // Find existing store
  let store = await this.findOne({ classroomId, userId });

  if (!store) {
    // Create new store if it doesn't exist
    store = new this({
      classroomId,
      userId,
      shopName: storeFields.shopName,
      storeDescription: storeFields.storeDescription,
      storeLocation: storeFields.storeLocation,
      startingBalance: storeFields.startingBalance || 0,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
  } else {
    // Update existing store fields
    if (storeFields.shopName !== undefined) {
      store.shopName = storeFields.shopName;
    }
    if (storeFields.storeDescription !== undefined) {
      store.storeDescription = storeFields.storeDescription;
    }
    if (storeFields.storeLocation !== undefined) {
      store.storeLocation = storeFields.storeLocation;
    }
    if (storeFields.startingBalance !== undefined) {
      store.startingBalance = storeFields.startingBalance;
    }
    store.updatedBy = clerkUserId;
  }

  await store.save();

  // Update or create variable values if provided
  if (variables && typeof variables === "object") {
    const variableEntries = Object.entries(variables);
    for (const [key, value] of variableEntries) {
      await StoreVariableValue.setVariable(
        store._id,
        key,
        value,
        organizationId,
        clerkUserId
      );
    }

    // Delete variables that are not in the new set
    const existingVariables = await StoreVariableValue.find({
      storeId: store._id,
    });
    const newKeys = new Set(Object.keys(variables));
    for (const existingVar of existingVariables) {
      if (!newKeys.has(existingVar.variableKey)) {
        await StoreVariableValue.deleteOne({ _id: existingVar._id });
      }
    }
  }

  // Return store with variables populated
  return await this.getStoreByUser(classroomId, userId);
};

// Instance methods

/**
 * Get variables for this store instance
 * Uses cached variables if available, otherwise loads them
 * @returns {Promise<Object>} Variables object
 */
storeSchema.methods.getVariables = async function () {
  // Use plugin's cached variables or load them
  return await this._loadVariables();
};

/**
 * Check if store can be modified
 * @returns {boolean} Always true (stores can now be updated)
 */
storeSchema.methods.canModify = function () {
  return true;
};

const Store = mongoose.model("Store", storeSchema);

module.exports = Store;
