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

  try {
    // Check if initial ledger entry already exists
    const existingEntry = await LedgerEntry.findOne({
      classroomId,
      userId: store.userId,
      scenarioId: null, // Initial entries have null scenarioId
    });

    if (existingEntry) {
      // Entry already exists, skip creation
      return;
    }

    // Get starting balance and inventory from storeType preset
    // This is more reliable than loading variables, and ensures consistency
    const preset = getPreset(store.storeType);
    const startingBalance = preset.startingBalance || 0;
    const startingInventory = preset.startingInventory || 0;

    // Create initial ledger entry with null scenarioId
    await LedgerEntry.createLedgerEntry(
      {
        classroomId,
        scenarioId: null, // No scenario for initial entry
        userId: store.userId,
        sales: 0,
        revenue: 0,
        costs: 0,
        waste: 0,
        cashBefore: 0,
        cashAfter: startingBalance,
        inventoryBefore: 0,
        inventoryAfter: startingInventory,
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
  // Use setVariable to ensure all preset variables are saved
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
 * Get store by user with variables and current financial details from ledger
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Store with variables and currentDetails or null
 */
storeSchema.statics.getStoreByUserWithCurrentDetails = async function (
  classroomId,
  userId
) {
  const store = await this.getStoreByUser(classroomId, userId);

  if (!store) {
    return null;
  }

  // Get the most recent ledger entry for current financial state
  const LedgerEntry = require("../ledger/ledger.model");
  const ledgerHistory = await LedgerEntry.getLedgerHistory(classroomId, userId);

  // Extract current details from the most recent ledger entry
  const currentDetails = {};

  if (ledgerHistory.length > 0) {
    const lastEntry = ledgerHistory[ledgerHistory.length - 1];
    currentDetails.cashBalance = lastEntry.cashAfter;
    currentDetails.inventory = lastEntry.inventoryAfter;
    currentDetails.lastSales = lastEntry.sales;
    currentDetails.lastRevenue = lastEntry.revenue;
    currentDetails.lastCosts = lastEntry.costs;
    currentDetails.lastWaste = lastEntry.waste;
    currentDetails.lastNetProfit = lastEntry.netProfit;
    currentDetails.lastScenarioId = lastEntry.scenarioId;
    currentDetails.lastLedgerEntryDate = lastEntry.createdDate;
  } else {
    // No ledger entries yet - use initial values from store variables
    const variablesObj = {};
    if (store.variables && Array.isArray(store.variables)) {
      store.variables.forEach((v) => {
        variablesObj[v.key] = v.value;
      });
    }
    currentDetails.cashBalance = variablesObj.startingBalance || 0;
    currentDetails.inventory = variablesObj.startingInventory || 0;
    currentDetails.lastSales = 0;
    currentDetails.lastRevenue = 0;
    currentDetails.lastCosts = 0;
    currentDetails.lastWaste = 0;
    currentDetails.lastNetProfit = 0;
    currentDetails.lastScenarioId = null;
    currentDetails.lastLedgerEntryDate = null;
  }

  return {
    ...store,
    currentDetails,
  };
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
    const storeTypeChanged =
      storeType !== undefined && store.storeType !== storeType;

    if (storeType !== undefined) {
      // Validate storeType if provided
      if (!isValidStoreType(storeType)) {
        throw new Error(
          `Invalid storeType: ${storeType}. Must be one of: food_truck, indoor, outdoor`
        );
      }
      store.storeType = storeType;
    }

    // If storeType changed, update all preset variables for the new type
    if (storeTypeChanged) {
      // Use the new storeType (already updated above)
      const presetVariables = getPreset(store.storeType);
      // Merge with provided variables (provided variables override preset)
      const finalVariables = {
        ...presetVariables,
        ...(variables && typeof variables === "object" ? variables : {}),
      };

      // Update all preset variables
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
    } else if (variables && typeof variables === "object") {
      // Update only provided variables if storeType didn't change
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
    }

    // Ensure all preset variables exist (in case some were missing)
    // This handles cases where stores were created before preset logic was added
    const presetVariables = getPreset(store.storeType);
    const presetEntries = Object.entries(presetVariables);
    for (const [key, value] of presetEntries) {
      // Only set if not already set by variables above
      if (!variables || !(key in variables)) {
        const existing = await StoreVariableValue.findByStoreAndKey(
          store._id,
          key
        );
        if (!existing) {
          // Variable doesn't exist, create it with preset value
          await StoreVariableValue.setVariable(
            store._id,
            key,
            value,
            organizationId,
            clerkUserId
          );
        }
      }
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
