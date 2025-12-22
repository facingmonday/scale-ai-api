const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const StoreVariableValue = require("./storeVariableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");
const { getPreset, isValidStoreType } = require("./storeTypePresets");

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
  storeType: {
    type: String,
    enum: [
      "street_cart",
      "food_truck",
      "campus_kiosk",
      "cafe",
      "ghost_kitchen",
      "bar_and_grill",
      "franchise_location",
      "upscale_bistro",
      "fine_dining",
      "late_night_window",
    ],
    required: true,
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
storeSchema.index({ storeType: 1 });

/**
 * Create initial ledger entry for a newly created store
 * @private
 * @param {Object} store - Store document
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 */
storeSchema.statics._createInitialLedgerEntry = async function (
  store,
  classroomId,
  organizationId,
  clerkUserId
) {
  const LedgerEntry = require("../ledger/ledger.model");
  const Scenario = require("../scenario/scenario.model");

  try {
    // Find or create an initial scenario for this classroom (week 0)
    // Note: We create this directly with week 0, bypassing createScenario which auto-increments
    let initialScenario = await Scenario.findOne({
      classroomId,
      week: 0,
    });

    if (!initialScenario) {
      // Create initial scenario directly with week 0
      initialScenario = new Scenario({
        classroomId,
        week: 0,
        title: "Initial Store Setup",
        description: "Initial ledger entry for store creation",
        isPublished: false,
        isClosed: true, // Mark as closed so it doesn't interfere with regular scenarios
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });
      await initialScenario.save();
    }

    // Check if ledger entry already exists
    const existingEntry = await LedgerEntry.findOne({
      scenarioId: initialScenario._id,
      userId: store.userId,
    });

    if (existingEntry) {
      // Entry already exists, skip creation
      return;
    }

    // Get starting balance from storeType preset
    // This is more reliable than loading variables, and ensures consistency
    const preset = getPreset(store.storeType);
    const startingBalance = preset.startingBalance || 0;

    // Create initial ledger entry
    await LedgerEntry.createLedgerEntry(
      {
        classroomId,
        scenarioId: initialScenario._id,
        userId: store.userId,
        sales: 0,
        revenue: 0,
        costs: 0,
        waste: 0,
        cashBefore: 0,
        cashAfter: startingBalance,
        inventoryBefore: 0,
        inventoryAfter: 0,
        netProfit: startingBalance,
        summary: "Initial store setup",
        aiMetadata: {
          model: "system",
          runId: `initial-${store._id}`,
          generatedAt: new Date(),
        },
      },
      organizationId,
      clerkUserId
    );
  } catch (error) {
    // Log error but don't fail store creation if ledger entry fails
    console.error("Error creating initial ledger entry:", error);
    // Note: We continue even if ledger entry creation fails
    // This ensures store creation succeeds even if ledger setup has issues
  }
};

// Static methods - Shared utilities for store operations

/**
 * Create a store with variables
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @param {Object} storeData - Store data (shopName, storeDescription, storeLocation, storeType, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created store with variables
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

  // Validate storeType
  const { storeType, variables: providedVariables, ...storeFields } = storeData;

  if (!storeType) {
    throw new Error("storeType is required");
  }

  if (!isValidStoreType(storeType)) {
    throw new Error(
      `Invalid storeType: ${storeType}. Must be one of: food_truck, indoor, outdoor`
    );
  }

  // Load preset for store type
  const presetVariables = getPreset(storeType);

  // Merge preset with provided variables (provided variables override preset)
  const finalVariables = {
    ...presetVariables,
    ...(providedVariables && typeof providedVariables === "object"
      ? providedVariables
      : {}),
  };

  // Create store document
  const store = new this({
    classroomId,
    userId,
    shopName: storeFields.shopName,
    storeDescription: storeFields.storeDescription,
    storeLocation: storeFields.storeLocation,
    storeType,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await store.save();

  // Create variable values from preset and provided variables
  if (finalVariables && typeof finalVariables === "object") {
    const variableEntries = Object.entries(finalVariables);
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

  // Create initial ledger entry (week 0, type INITIAL)
  await this._createInitialLedgerEntry(
    store,
    classroomId,
    organizationId,
    clerkUserId
  );

  // Return store with variables populated via plugin
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

  // Convert variables array (from plugin) to object for AI
  const variablesObj = {};
  if (store.variables && Array.isArray(store.variables)) {
    store.variables.forEach((v) => {
      variablesObj[v.key] = v.value;
    });
  }

  // Return normalized object for AI simulation
  // Flatten store data: include storeType and variables directly
  return {
    shopName: store.shopName,
    storeType: store.storeType,
    storeDescription: store.storeDescription,
    storeLocation: store.storeLocation,
    ...variablesObj,
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
 * @param {Object} storeData - Store data (shopName, storeDescription, storeLocation, storeType, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated store with variables
 */
storeSchema.statics.updateStore = async function (
  classroomId,
  userId,
  storeData,
  organizationId,
  clerkUserId
) {
  // Extract variables and storeType from storeData
  const { variables, storeType, ...storeFields } = storeData;

  // Find existing store
  let store = await this.findOne({ classroomId, userId });

  if (!store) {
    // If store doesn't exist and storeType is provided, create new store
    if (!storeType) {
      throw new Error("storeType is required when creating a new store");
    }

    if (!isValidStoreType(storeType)) {
      throw new Error(
        `Invalid storeType: ${storeType}. Must be one of: food_truck, indoor, outdoor`
      );
    }

    // Load preset for store type
    const presetVariables = getPreset(storeType);

    // Merge preset with provided variables
    const finalVariables = {
      ...presetVariables,
      ...(variables && typeof variables === "object" ? variables : {}),
    };

    // Create new store
    store = new this({
      classroomId,
      userId,
      shopName: storeFields.shopName,
      storeDescription: storeFields.storeDescription,
      storeLocation: storeFields.storeLocation,
      storeType,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await store.save();

    // Create variable values from preset and provided variables
    if (finalVariables && typeof finalVariables === "object") {
      const variableEntries = Object.entries(finalVariables);
      for (const [key, value] of variableEntries) {
        await StoreVariableValue.setVariable(
          store._id,
          key,
          value,
          organizationId,
          clerkUserId
        );
      }
    }

    // Create initial ledger entry for new store
    await this._createInitialLedgerEntry(
      store,
      classroomId,
      organizationId,
      clerkUserId
    );
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
    if (storeType !== undefined) {
      // Validate storeType if provided
      if (!isValidStoreType(storeType)) {
        throw new Error(
          `Invalid storeType: ${storeType}. Must be one of: food_truck, indoor, outdoor`
        );
      }
      store.storeType = storeType;
    }

    // Update variables if provided
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

      // Delete variables that are not in the new set (if we want to support removal)
      // Note: This behavior can be adjusted based on requirements
    }

    store.updatedBy = clerkUserId;
    await store.save();

    // Check if initial ledger entry exists, create if it doesn't
    // This handles cases where a store was created before initial ledger logic was added
    await this._createInitialLedgerEntry(
      store,
      classroomId,
      organizationId,
      clerkUserId
    );
  }

  // Return store with variables populated via plugin
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
  const variablesArray = await this._loadVariables();

  // Convert array format to object format for convenience
  const variablesObj = {};
  variablesArray.forEach((v) => {
    variablesObj[v.key] = v.value;
  });

  return variablesObj;
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
