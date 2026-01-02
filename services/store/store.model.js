const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableValue = require("../variableDefinition/variableValue.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");
const StoreType = require("../storeType/storeType.model");
const LedgerEntry = require("../ledger/ledger.model");

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
  imageUrl: {
    type: String,
    required: false,
  },
  storeType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StoreType",
    required: true,
  },
}).add(baseSchema);

// Apply variable population plugin
storeSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "store",
  outputFormat: "valueMap",
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

    // Get starting balance and inventory from storeType variables
    // StoreType variables are stored as VariableValue(appliesTo="storeType", ownerId=storeTypeId)
    const storeTypeDoc = await StoreType.findById(store.storeType);
    if (!storeTypeDoc) {
      throw new Error("Store type not found");
    }
    await storeTypeDoc._loadVariables();
    const storeTypeVars =
      storeTypeDoc.variables &&
      typeof storeTypeDoc.variables === "object" &&
      !Array.isArray(storeTypeDoc.variables)
        ? storeTypeDoc.variables
        : {};
    const startingBalance = storeTypeVars.startingBalance || 0;
    const startingInventory = storeTypeVars.startingInventory || 0;

    // Handle both number (legacy) and object (new bucket-based) formats for startingInventory
    let initialInventoryState;
    if (
      typeof startingInventory === "object" &&
      startingInventory !== null &&
      !Array.isArray(startingInventory)
    ) {
      // Object format with bucket structure
      initialInventoryState = {
        refrigeratedUnits: startingInventory.refrigeratedUnits || 0,
        ambientUnits: startingInventory.ambientUnits || 0,
        notForResaleUnits: startingInventory.notForResaleUnits || 0,
      };
    } else {
      // Legacy number format: all inventory in refrigerated
      initialInventoryState = {
        refrigeratedUnits: Number(startingInventory) || 0,
        ambientUnits: 0,
        notForResaleUnits: 0,
      };
    }

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
        inventoryState: initialInventoryState,
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

  // Validate storeType (should be ObjectId)
  const {
    storeType,
    variables: providedVariables,
    imageUrl,
    ...storeFields
  } = storeData;

  if (!storeType) {
    throw new Error("storeType is required");
  }

  // Validate storeType exists and belongs to organization
  const storeTypeDoc = await StoreType.getStoreTypeById(
    organizationId,
    storeType
  );
  if (!storeTypeDoc) {
    throw new Error(
      "Invalid storeType: Store type not found or does not belong to this organization"
    );
  }

  const providedVars =
    providedVariables && typeof providedVariables === "object"
      ? providedVariables
      : {};

  // Create store document
  const store = new this({
    classroomId,
    userId,
    shopName: storeFields.shopName,
    storeDescription: storeFields.storeDescription,
    storeLocation: storeFields.storeLocation,
    storeType: storeTypeDoc._id,
    imageUrl: imageUrl || null,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await store.save();

  // Create variable values from active definitions, using provided values first,
  // then definition defaultValue. Presets are NOT persisted - they're used at read time.
  const definitions = await VariableDefinition.getDefinitionsForScope(
    classroomId,
    "store"
  );
  const variableDocs = definitions
    .map((def) => {
      const key = def.key;
      const value =
        providedVars[key] !== undefined
          ? providedVars[key]
          : def.defaultValue !== undefined
            ? def.defaultValue
            : null;

      return {
        appliesTo: "store",
        ownerId: store._id,
        variableKey: key,
        value,
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      };
    })
    // Don't store nulls to keep the collection lean; plugin will return null anyway
    .filter((doc) => doc.value !== null);

  if (variableDocs.length > 0) {
    await VariableValue.insertMany(variableDocs);
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
  const store = await this.findOne({ classroomId, userId }).populate(
    "storeType"
  );

  if (!store) {
    return null;
  }
  // Explicitly load variables before calling toObject()
  // The post-init hook is async and may not complete before toObject() is called
  await store._loadVariables();

  // Load storeType variables if storeType is populated
  if (
    store.storeType &&
    typeof store.storeType === "object" &&
    store.storeType._id
  ) {
    await store.storeType._loadVariables();
  }

  // Get current ledger summary details
  const currentDetails = await LedgerEntry.getLedgerSummary(
    classroomId,
    userId
  );

  // Variables are automatically included via plugin's toObject() override
  const storeObj = store.toObject();

  // Add storeType info for backward compatibility
  if (storeObj.storeType && typeof storeObj.storeType === "object") {
    storeObj.storeTypeKey = storeObj.storeType.key;
    storeObj.storeTypeLabel = storeObj.storeType.label;
    // storeType.variables should already be included via plugin's toObject()
  }

  // Add currentDetails to the returned object (must be added after toObject() since it's not a schema field)
  storeObj.currentDetails = currentDetails;

  // Add ledger entries to the returned object
  storeObj.ledgerEntries = await LedgerEntry.getLedgerEntriesByStore(store._id);

  return storeObj;
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

  // Variables are returned as a map (valueMap plugin output format)
  const variablesObj =
    store.variables &&
    typeof store.variables === "object" &&
    !Array.isArray(store.variables)
      ? store.variables
      : {};

  const storeTypeVariables =
    store.storeType?.variables &&
    typeof store.storeType.variables === "object" &&
    !Array.isArray(store.storeType.variables)
      ? store.storeType.variables
      : {};

  // Merge storeType defaults with store overrides (store wins)
  const mergedVariableValues = {
    ...storeTypeVariables,
    ...variablesObj,
  };

  // Build variable metadata (label/description) from definitions so the simulation context
  // can include richer info for debugging/teaching: { key, label, description, value }
  const organizationId =
    store.organization?.toString?.() ||
    store.storeType?.organization?.toString?.() ||
    store.storeType?.organization ||
    null;

  const [storeDefs, storeTypeDefs] = await Promise.all([
    VariableDefinition.getDefinitionsForScope(classroomId, "store"),
    organizationId
      ? VariableDefinition.getDefinitionsForScope(null, "storeType", {
          organizationId,
        })
      : Promise.resolve([]),
  ]);

  const metaByKey = new Map();
  // Start with storeType definitions, then let store definitions override if same key exists.
  (storeTypeDefs || []).forEach((def) => {
    metaByKey.set(def.key, {
      label: def.label,
      description: def.description || "",
    });
  });
  (storeDefs || []).forEach((def) => {
    metaByKey.set(def.key, {
      label: def.label,
      description: def.description || "",
    });
  });

  // mergedVariables = { [variableKey]: { key, label, description, value } }
  const mergedVariables = {};
  Object.entries(mergedVariableValues).forEach(([key, value]) => {
    const meta = metaByKey.get(key);
    mergedVariables[key] = {
      key,
      label: meta?.label || key,
      description: meta?.description || "",
      value,
    };
  });

  // Get storeType key for backward compatibility
  // storeType should already be populated by getStoreByUser
  const storeTypeKey = store.storeTypeKey || store.storeType?.key || null;
  const storeTypeId =
    store.storeType?._id?.toString() || store.storeType?.toString() || null;

  // Return normalized object for AI simulation
  // Flatten store data: include storeType key and variables directly
  return {
    shopName: store.shopName,
    storeType: storeTypeKey, // Return key for compatibility
    storeTypeId: storeTypeId, // Also include ID
    storeDescription: store.storeDescription,
    storeLocation: store.storeLocation,
    // Flat values at top-level (backward compatibility + easiest for AI)
    ...mergedVariableValues,
    // Rich metadata map for debugging/teaching/inspection
    variablesDetailed: mergedVariables,
  };
};

/**
 * Get all stores for a class
 * @param {string} classroomId - Class ID
 * @returns {Promise<Array>} Array of stores with variables
 */
storeSchema.statics.getStoresByClass = async function (classroomId) {
  const stores = await this.find({ classroomId }).populate("storeType");

  // Use plugin's efficient batch population for store variables
  await this.populateVariablesForMany(stores);

  // Load variables for all populated storeTypes
  const storeTypes = stores
    .map((store) => store.storeType)
    .filter((st) => st && typeof st === "object" && st._id);

  if (storeTypes.length > 0) {
    // Batch load variables for all storeTypes efficiently
    const storeTypeIds = storeTypes.map((st) => st._id);
    const allStoreTypeVariables = await VariableValue.find({
      appliesTo: "storeType",
      ownerId: { $in: storeTypeIds },
    });

    // Group variables by storeType ownerId
    const variablesByStoreType = {};
    allStoreTypeVariables.forEach((v) => {
      const ownerId = v.ownerId.toString();
      if (!variablesByStoreType[ownerId]) {
        variablesByStoreType[ownerId] = {};
      }
      variablesByStoreType[ownerId][v.variableKey] = v.value;
    });

    // Assign variables to each storeType
    storeTypes.forEach((storeType) => {
      const ownerId = storeType._id.toString();
      storeType._storeTypeVariables = variablesByStoreType[ownerId] || {};
    });
  }

  // Variables are automatically included via plugin
  return stores.map((store) => {
    const storeObj = store.toObject();
    // Add storeType info for backward compatibility
    if (storeObj.storeType && typeof storeObj.storeType === "object") {
      storeObj.storeTypeKey = storeObj.storeType.key;
      storeObj.storeTypeLabel = storeObj.storeType.label;
      // storeType.variables should already be included via plugin's toObject()
    }
    return storeObj;
  });
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
  // Extract variables, storeType, and imageUrl from storeData
  const {
    variables: providedVariables,
    storeType,
    imageUrl,
    ...storeFields
  } = storeData;

  // Find existing store
  let store = await this.findOne({ classroomId, userId });

  if (!store) {
    // If store doesn't exist and storeType is provided, create new store
    if (!storeType) {
      throw new Error("storeType is required when creating a new store");
    }

    // Validate storeType exists and belongs to organization
    const storeTypeDoc = await StoreType.getStoreTypeById(
      organizationId,
      storeType
    );
    if (!storeTypeDoc) {
      throw new Error(
        "Invalid storeType: Store type not found or does not belong to this organization"
      );
    }

    const providedVars =
      providedVariables && typeof providedVariables === "object"
        ? providedVariables
        : {};

    // Create new store
    store = new this({
      classroomId,
      userId,
      shopName: storeFields.shopName,
      storeDescription: storeFields.storeDescription,
      storeLocation: storeFields.storeLocation,
      storeType: storeTypeDoc._id, // Use store type ObjectId
      imageUrl: imageUrl || null,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await store.save();

    // Create variable values from active definitions, using provided values first,
    // then definition defaultValue. Presets are NOT persisted - they're used at read time.
    const definitions = await VariableDefinition.getDefinitionsForScope(
      classroomId,
      "store"
    );
    const variableDocs = definitions
      .map((def) => {
        const key = def.key;
        const value =
          providedVars[key] !== undefined
            ? providedVars[key]
            : def.defaultValue !== undefined
              ? def.defaultValue
              : null;

        return {
          appliesTo: "store",
          ownerId: store._id,
          variableKey: key,
          value,
          organization: organizationId,
          createdBy: clerkUserId,
          updatedBy: clerkUserId,
        };
      })
      .filter((doc) => doc.value !== null);

    if (variableDocs.length > 0) {
      await VariableValue.insertMany(variableDocs);
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
      // Convert to ObjectId for comparison
      const currentStoreTypeId = store.storeType?.toString();
      const newStoreTypeId = storeType.toString();

      if (currentStoreTypeId !== newStoreTypeId) {
        // Validate storeType exists and belongs to organization
        const storeTypeDoc = await StoreType.getStoreTypeById(
          organizationId,
          storeType
        );
        if (!storeTypeDoc) {
          throw new Error(
            "Invalid storeType: Store type not found or does not belong to this organization"
          );
        }
        store.storeType = storeTypeDoc._id;
      }
    }
    if (imageUrl !== undefined) {
      store.imageUrl = imageUrl || null;
    }

    store.updatedBy = clerkUserId;
    await store.save();
  }

  // Update or create variable values if provided
  if (providedVariables && typeof providedVariables === "object") {
    const variableEntries = Object.entries(providedVariables);
    for (const [key, value] of variableEntries) {
      await VariableValue.setVariable(
        "store",
        store._id,
        key,
        value,
        organizationId,
        clerkUserId
      );
    }

    // Delete variables that are not in the new set
    const existingVariables = await VariableValue.find({
      appliesTo: "store",
      ownerId: store._id,
    });
    const newKeys = new Set(Object.keys(providedVariables));
    for (const existingVar of existingVariables) {
      if (!newKeys.has(existingVar.variableKey)) {
        await VariableValue.deleteOne({ _id: existingVar._id });
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
  // Use plugin's cached variables or load them (valueMap format)
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
