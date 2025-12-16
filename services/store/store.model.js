const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const StoreVariableValue = require("./storeVariableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");

const storeSchema = new mongoose.Schema({
  classId: {
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
  storeType: {
    type: String,
    enum: ["indoor", "outdoor", "food_truck"],
    required: true,
  },
  dailyCapacity: {
    type: Number,
    required: true,
    min: 1,
  },
  deliveryRatio: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
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
});

// Compound indexes for performance
storeSchema.index({ classId: 1, userId: 1 }, { unique: true });
storeSchema.index({ classId: 1 });
storeSchema.index({ userId: 1 });
storeSchema.index({ organization: 1, classId: 1 });

// Static methods - Shared utilities for store operations

/**
 * Create a store with variables
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @param {Object} storeData - Store data (shopName, storeType, dailyCapacity, deliveryRatio, startingBalance, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created store with populated variables
 */
storeSchema.statics.createStore = async function (
  classId,
  userId,
  storeData,
  organizationId,
  clerkUserId
) {
  // Check if store already exists
  const existing = await this.findOne({ classId, userId });
  if (existing) {
    throw new Error("Store already exists for this user in this class");
  }

  // Extract variables from storeData
  const { variables, ...storeFields } = storeData;

  // Create store document
  const store = new this({
    classId,
    userId,
    shopName: storeFields.shopName,
    storeType: storeFields.storeType,
    dailyCapacity: storeFields.dailyCapacity,
    deliveryRatio: storeFields.deliveryRatio,
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
  return await this.getStoreByUser(classId, userId);
};

/**
 * Get store by user with variables
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Store with variables or null
 */
storeSchema.statics.getStoreByUser = async function (classId, userId) {
  const store = await this.findOne({ classId, userId });

  if (!store) {
    return null;
  }

  // Variables are automatically included via plugin's post-init hook
  return store.toObject();
};

/**
 * Check if store exists for user in class
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<boolean>} True if store exists
 */
storeSchema.statics.storeExists = async function (classId, userId) {
  const count = await this.countDocuments({ classId, userId });
  return count > 0;
};

/**
 * Get store data formatted for AI simulation
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Normalized store data for AI or null
 */
storeSchema.statics.getStoreForSimulation = async function (classId, userId) {
  const store = await this.getStoreByUser(classId, userId);

  if (!store) {
    return null;
  }

  // Return normalized object for AI simulation
  return {
    storeType: store.storeType,
    dailyCapacity: store.dailyCapacity,
    deliveryRatio: store.deliveryRatio,
    startingBalance: store.startingBalance,
    variables: store.variables || {},
  };
};

/**
 * Get all stores for a class
 * @param {string} classId - Class ID
 * @returns {Promise<Array>} Array of stores with variables
 */
storeSchema.statics.getStoresByClass = async function (classId) {
  const stores = await this.find({ classId });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(stores);

  // Variables are automatically included via plugin
  return stores.map((store) => store.toObject());
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
 * Check if store can be modified (immutable in MVP)
 * @returns {boolean} Always false in MVP
 */
storeSchema.methods.canModify = function () {
  return false; // Store is immutable after creation in MVP
};

const Store = mongoose.model("Store", storeSchema);

module.exports = Store;
