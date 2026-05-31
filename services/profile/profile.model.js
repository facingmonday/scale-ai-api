const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableValue = require("../variableDefinition/variableValue.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");
const ProfileType = require("../profileType/profileType.model");
const LedgerEntry = require("../ledger/ledger.model");
const { v4: uuidv4 } = require("uuid");

async function ensureClassroomPromptsInitialized(
  classroomId,
  organizationId,
  clerkUserId
) {
  const Classroom = require("../classroom/classroom.model");
  const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");

  const classDoc = await Classroom.findOne({
    _id: classroomId,
    organization: organizationId,
  }).select("prompts updatedBy");

  if (!classDoc) return false;
  if (Array.isArray(classDoc.prompts) && classDoc.prompts.length > 0)
    return false;

  // Ensure org has the default template, then use its prompts.
  await ClassroomTemplate.copyGlobalToOrganization(organizationId, clerkUserId);
  const template = await ClassroomTemplate.findOne({
    organization: organizationId,
    key: ClassroomTemplate.GLOBAL_DEFAULT_KEY,
    isActive: true,
  });

  const prompts =
    template?.payload?.prompts ||
    ClassroomTemplate.getDefaultClassroomPrompts();

  if (Array.isArray(prompts) && prompts.length > 0) {
    classDoc.prompts = prompts;
    classDoc.updatedBy = clerkUserId;
    await classDoc.save();
    return true;
  }

  return false;
}

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
  studentId: {
    type: String,
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
  profileType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProfileType",
    required: true,
  },
}).add(baseSchema);

// Apply variable population plugin
storeSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "profile",
  outputFormat: "valueMap",
});

// Compound indexes for performance
storeSchema.index({ classroomId: 1, userId: 1 }, { unique: true });
storeSchema.index({ classroomId: 1 });
storeSchema.index({ userId: 1 });
storeSchema.index({ organization: 1, classroomId: 1 });
storeSchema.index({ profileType: 1 });

// Static methods - Shared utilities for profile operations

/**
 * Validate and get profileType document
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {string|ObjectId} profileType - Profile type ID or ObjectId
 * @returns {Promise<Object>} ProfileType document
 * @throws {Error} If profileType is invalid or not found
 */
storeSchema.statics.validateAndGetStoreType = async function (
  classroomId,
  organizationId,
  profileType
) {
  if (!profileType) {
    throw new Error("profileType is required");
  }

  const storeTypeDoc = await ProfileType.getStoreTypeById(
    classroomId,
    organizationId,
    profileType
  );

  if (!storeTypeDoc) {
    throw new Error(
      "Invalid profileType: Profile type not found or does not belong to this organization"
    );
  }

  return storeTypeDoc;
};

/**
 * Create variable values for a profile from definitions
 * @param {string} classroomId - Class ID
 * @param {ObjectId} profileId - Profile ID
 * @param {Object} providedVariables - Provided variable values
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<void>}
 */
storeSchema.statics.createStoreVariables = async function (
  classroomId,
  profileId,
  providedVariables,
  organizationId,
  clerkUserId
) {
  const providedVars =
    providedVariables && typeof providedVariables === "object"
      ? providedVariables
      : {};

  const definitions = await VariableDefinition.getDefinitionsForScope(
    classroomId,
    "profile"
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
        classroomId,
        appliesTo: "profile",
        ownerId: profileId,
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
};

/**
 * Seed initial ledger entry (week 0) for a new profile.
 * Builds the metrics map from each MetricDefinition.defaultInitialValue
 * for the classroom.
 *
 * @param {ObjectId} profileId
 * @param {string} classroomId
 * @param {string} userId
 * @param {string} organizationId
 * @param {string} clerkUserId
 * @returns {Promise<void>}
 */
storeSchema.statics.seedInitialLedgerEntry = async function (
  profileId,
  classroomId,
  userId,
  organizationId,
  clerkUserId
) {
  const existingInitial = await LedgerEntry.findOne({
    classroomId,
    userId,
    challengeId: null,
  }).select("_id");

  if (existingInitial) {
    return;
  }

  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  const metricDefs = await MetricDefinition.find({
    classroomId,
    isActive: true,
  }).lean();

  const metrics = {};
  for (const def of metricDefs) {
    if (def.defaultInitialValue === undefined || def.defaultInitialValue === null) {
      if (def.dataType === "number") metrics[def.key] = 0;
      else if (def.dataType === "boolean") metrics[def.key] = false;
      else metrics[def.key] = "";
    } else {
      metrics[def.key] = def.defaultInitialValue;
    }
  }

  await LedgerEntry.createLedgerEntry(
    {
      profileId,
      classroomId,
      challengeId: null,
      decisionId: null,
      userId,
      metrics,
      randomEvent: null,
      summary: "Week 0: Profile setup — initial values seeded from classroom metric definitions.",
      aiMetadata: {
        model: "system_seed",
        runId: uuidv4(),
        generatedAt: new Date(),
      },
      calculationContext: {
        profileVariables: {},
        challengeVariables: {},
        decisionVariables: {},
        outcomeVariables: {},
        priorMetrics: {},
        prompt: null,
      },
    },
    organizationId,
    clerkUserId
  );
};

/**
 * Create a new profile document with all setup (variables only - ledger entry handled in updateStore)
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @param {Object} storeFields - Profile fields (studentId, shopName, storeDescription, storeLocation)
 * @param {ObjectId} storeTypeId - ProfileType ObjectId
 * @param {string|null} imageUrl - Optional image URL
 * @param {Object} providedVariables - Provided variable values
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} Created profile
 */
storeSchema.statics.createNewStore = async function (
  classroomId,
  userId,
  storeFields,
  storeTypeId,
  imageUrl,
  providedVariables,
  organizationId,
  clerkUserId
) {
  // Ensure classroom prompts exist (older classrooms may predate prompt templates)
  await ensureClassroomPromptsInitialized(
    classroomId,
    organizationId,
    clerkUserId
  );

  // Create profile document
  const profile = new this({
    classroomId,
    userId,
    studentId: storeFields.studentId,
    shopName: storeFields.shopName,
    storeDescription: storeFields.storeDescription,
    storeLocation: storeFields.storeLocation,
    profileType: storeTypeId,
    imageUrl: imageUrl || null,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await profile.save();

  // Create variable values
  await this.createStoreVariables(
    classroomId,
    profile._id,
    providedVariables,
    organizationId,
    clerkUserId
  );

  return profile;
};

/**
 * Create a profile with variables (upsert behavior - creates if doesn't exist)
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @param {Object} storeData - Profile data (shopName, storeDescription, storeLocation, profileType, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created profile with variables
 */
storeSchema.statics.createStore = async function (
  classroomId,
  userId,
  storeData,
  organizationId,
  clerkUserId
) {
  // Delegate to updateStore which now handles upsert
  return await this.updateStore(
    classroomId,
    userId,
    storeData,
    organizationId,
    clerkUserId
  );
};

/**
 * Get profile by user with variables
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Profile with variables or null
 */
storeSchema.statics.getStoreByUser = async function (classroomId, userId) {
  const profile = await this.findOne({ classroomId, userId }).populate(
    "profileType"
  );

  if (!profile) {
    return null;
  }
  // Explicitly load variables before calling toObject()
  // The post-init hook is async and may not complete before toObject() is called
  await profile._loadVariables();

  // Load profileType variables if profileType is populated
  if (
    profile.profileType &&
    typeof profile.profileType === "object" &&
    profile.profileType._id
  ) {
    await profile.profileType._loadVariables();
  }

  // Variables are automatically included via plugin's toObject() override
  const storeObj = profile.toObject();

  // Add profileType info for backward compatibility
  if (storeObj.profileType && typeof storeObj.profileType === "object") {
    storeObj.storeTypeKey = storeObj.profileType.key;
    storeObj.storeTypeLabel = storeObj.profileType.label;
    // profileType.variables should already be included via plugin's toObject()
  }

  // Add ledger entries to the returned object
  storeObj.ledgerEntries = await LedgerEntry.getLedgerEntriesByStore(profile._id);

  return storeObj;
};

/**
 * Check if profile exists for user in class
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<boolean>} True if profile exists
 */
storeSchema.statics.storeExists = async function (classroomId, userId) {
  const count = await this.countDocuments({ classroomId, userId });
  return count > 0;
};

/**
 * Get profile data formatted for AI simulation
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Normalized profile data for AI or null
 */
storeSchema.statics.getStoreForSimulation = async function (
  classroomId,
  userId
) {
  const profile = await this.getStoreByUser(classroomId, userId);

  if (!profile) {
    return null;
  }

  // Variables are returned as a map (valueMap plugin output format)
  const variablesObj =
    profile.variables &&
    typeof profile.variables === "object" &&
    !Array.isArray(profile.variables)
      ? profile.variables
      : {};

  const storeTypeVariables =
    profile.profileType?.variables &&
    typeof profile.profileType.variables === "object" &&
    !Array.isArray(profile.profileType.variables)
      ? profile.profileType.variables
      : {};

  // Some profileType signals now live on the ProfileType document (not variables).
  // Use them as fallback if not present in variable values.
  const storeTypeDocFields = {};
  if (
    profile.profileType &&
    typeof profile.profileType === "object" &&
    profile.profileType._id
  ) {
    if (
      storeTypeVariables.startingBalance === undefined &&
      profile.profileType.startingBalance !== undefined &&
      profile.profileType.startingBalance !== null
    ) {
      storeTypeDocFields.startingBalance = profile.profileType.startingBalance;
    }
    if (
      storeTypeVariables.initialStartupCost === undefined &&
      profile.profileType.initialStartupCost !== undefined &&
      profile.profileType.initialStartupCost !== null
    ) {
      storeTypeDocFields.initialStartupCost =
        profile.profileType.initialStartupCost;
    }
  }

  // Merge profileType defaults with profile overrides (profile wins)
  const mergedVariableValues = {
    ...storeTypeVariables,
    ...storeTypeDocFields,
    ...variablesObj,
  };

  // Build variable metadata (label/description) from definitions so the simulation context
  // can include richer info for debugging/teaching: { key, label, description, value }
  const organizationId =
    profile.organization?.toString?.() ||
    profile.profileType?.organization?.toString?.() ||
    profile.profileType?.organization ||
    null;

  // Backward-compat / normalization: if we have bucketed starting inventory keys but not
  // the legacy startingInventory object, expose startingInventory as an object for code paths
  // that still expect it (initial ledger + worker).
  if (
    (mergedVariableValues.startingInventory === undefined ||
      mergedVariableValues.startingInventory === null) &&
    (mergedVariableValues.startingInventoryRefrigeratedUnits !== undefined ||
      mergedVariableValues.startingInventoryAmbientUnits !== undefined ||
      mergedVariableValues.startingInventoryNotForResaleUnits !== undefined)
  ) {
    mergedVariableValues.startingInventory = {
      refrigeratedUnits:
        Number(mergedVariableValues.startingInventoryRefrigeratedUnits) || 0,
      ambientUnits:
        Number(mergedVariableValues.startingInventoryAmbientUnits) || 0,
      notForResaleUnits:
        Number(mergedVariableValues.startingInventoryNotForResaleUnits) || 0,
    };
  }

  const [storeDefs, storeTypeDefs] = await Promise.all([
    VariableDefinition.getDefinitionsForScope(classroomId, "profile"),
    VariableDefinition.getDefinitionsForScope(classroomId, "profileType"),
  ]);

  const metaByKey = new Map();
  // Start with profileType definitions, then let profile definitions override if same key exists.
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

  // Get profileType key for backward compatibility
  // profileType should already be populated by getStoreByUser
  const storeTypeKey = profile.storeTypeKey || profile.profileType?.key || null;
  const storeTypeId =
    profile.profileType?._id?.toString() || profile.profileType?.toString() || null;
  const storeTypeLabel =
    profile.storeTypeLabel || profile.profileType?.label || storeTypeKey || null;
  const storeTypeDescription =
    profile.profileType?.description !== undefined &&
    profile.profileType?.description !== null
      ? String(profile.profileType.description)
      : "";

  // Return normalized object for AI simulation
  // Flatten profile data: include profileType key and variables directly
  return {
    profileId: profile._id?.toString?.() || null,
    studentId: profile.studentId,
    shopName: profile.shopName,
    profileType: storeTypeKey, // Return key for compatibility
    storeTypeId: storeTypeId, // Also include ID
    storeTypeLabel,
    storeTypeDescription,
    storeDescription: profile.storeDescription,
    storeLocation: profile.storeLocation,
    // Flat values at top-level (backward compatibility + easiest for AI)
    ...mergedVariableValues,
    // Rich metadata map for debugging/teaching/inspection
    variablesDetailed: mergedVariables,
  };
};

/**
 * Get all profiles for a class
 * @param {string} classroomId - Class ID
 * @returns {Promise<Array>} Array of profiles with variables
 */
storeSchema.statics.getStoresByClass = async function (classroomId) {
  const profiles = await this.find({ classroomId }).populate("profileType");

  // Use plugin's efficient batch population for profile variables
  await this.populateVariablesForMany(profiles);

  // Load variables for all populated profileTypes
  const profileTypes = profiles
    .map((profile) => profile.profileType)
    .filter((st) => st && typeof st === "object" && st._id);

  if (profileTypes.length > 0) {
    // Batch load variables for all profileTypes efficiently
    const storeTypeIds = profileTypes.map((st) => st._id);
    const allStoreTypeVariables = await VariableValue.find({
      classroomId,
      appliesTo: "profileType",
      ownerId: { $in: storeTypeIds },
    });

    // Group variables by profileType ownerId
    const variablesByStoreType = {};
    allStoreTypeVariables.forEach((v) => {
      const ownerId = v.ownerId.toString();
      if (!variablesByStoreType[ownerId]) {
        variablesByStoreType[ownerId] = {};
      }
      variablesByStoreType[ownerId][v.variableKey] = v.value;
    });

    // Assign variables to each profileType
    profileTypes.forEach((profileType) => {
      const ownerId = profileType._id.toString();
      profileType._storeTypeVariables = variablesByStoreType[ownerId] || {};
    });
  }

  // Variables are automatically included via plugin
  return profiles.map((profile) => {
    const storeObj = profile.toObject();
    // Add profileType info for backward compatibility
    if (storeObj.profileType && typeof storeObj.profileType === "object") {
      storeObj.storeTypeKey = storeObj.profileType.key;
      storeObj.storeTypeLabel = storeObj.profileType.label;
      // profileType.variables should already be included via plugin's toObject()
    }
    return storeObj;
  });
};

/**
 * Update a profile with variables (upsert - creates if doesn't exist)
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @param {Object} storeData - Profile data (shopName, storeDescription, storeLocation, profileType, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated or created profile with variables
 */
storeSchema.statics.updateStore = async function (
  classroomId,
  userId,
  storeData,
  organizationId,
  clerkUserId
) {
  // Extract variables, profileType, and imageUrl from storeData
  const {
    variables: providedVariables,
    profileType,
    imageUrl,
    ...storeFields
  } = storeData;

  // Find existing profile
  let profile = await this.findOne({ classroomId, userId });
  let storeTypeDoc = null;
  let storeTypeChanged = false;

  if (!profile) {
    // Create new profile if it doesn't exist
    if (!profileType) {
      throw new Error("profileType is required when creating a new profile");
    }

    // Validate required fields for creation
    if (!storeFields.studentId) {
      throw new Error("studentId is required when creating a new profile");
    }
    if (!storeFields.shopName) {
      throw new Error("shopName is required when creating a new profile");
    }
    if (!storeFields.storeDescription) {
      throw new Error("storeDescription is required when creating a new profile");
    }
    if (!storeFields.storeLocation) {
      throw new Error("storeLocation is required when creating a new profile");
    }

    // Validate and get profileType
    storeTypeDoc = await this.validateAndGetStoreType(
      classroomId,
      organizationId,
      profileType
    );

    // Create new profile using shared helper (without ledger entry - will seed after)
    profile = await this.createNewStore(
      classroomId,
      userId,
      storeFields,
      storeTypeDoc._id,
      imageUrl,
      providedVariables,
      organizationId,
      clerkUserId
    );

    // Seed initial ledger entry for new profile
    await this.seedInitialLedgerEntry(
      profile._id,
      classroomId,
      userId,
      organizationId,
      clerkUserId
    );
  } else {
    // Update existing profile fields
    if (storeFields.studentId !== undefined) {
      profile.studentId = storeFields.studentId;
    }
    if (storeFields.shopName !== undefined) {
      profile.shopName = storeFields.shopName;
    }
    if (storeFields.storeDescription !== undefined) {
      profile.storeDescription = storeFields.storeDescription;
    }
    if (storeFields.storeLocation !== undefined) {
      profile.storeLocation = storeFields.storeLocation;
    }
    if (profileType !== undefined) {
      // Convert to ObjectId for comparison
      const currentStoreTypeId = profile.profileType?.toString();
      const newStoreTypeId = profileType.toString();

      if (currentStoreTypeId !== newStoreTypeId) {
        // Validate profileType exists and belongs to organization
        storeTypeDoc = await this.validateAndGetStoreType(
          classroomId,
          organizationId,
          profileType
        );
        profile.profileType = storeTypeDoc._id;
        storeTypeChanged = true;

        // If profileType changed, handle initial ledger entry:
        // - If there's only the initial entry: delete and reseed with new profileType
        // - If there's no initial entry: seed one with the new profileType
        const allLedgerEntries = await LedgerEntry.find({ profileId: profile._id });
        const initialLedgerEntry = allLedgerEntries.find(
          (entry) => entry.challengeId == null // Use == to check for both null and undefined
        );
        const hasOnlyInitialEntry =
          allLedgerEntries.length === 1 && initialLedgerEntry !== undefined;

        // Track if we deleted the initial entry so we know to reseed
        let deletedInitialEntry = false;

        if (hasOnlyInitialEntry && initialLedgerEntry) {
          // Delete the existing initial ledger entry (will reseed below)
          await LedgerEntry.deleteOne({ _id: initialLedgerEntry._id });
          deletedInitialEntry = true;
        }

        // Seed initial entry if:
        // - We just deleted it (deletedInitialEntry is true), OR
        // - There's no initial entry at all (initialLedgerEntry is undefined)
        if (deletedInitialEntry || !initialLedgerEntry) {
          await this.seedInitialLedgerEntry(
            profile._id,
            classroomId,
            userId,
            organizationId,
            clerkUserId
          );
        }
      }
    }
    if (imageUrl !== undefined) {
      profile.imageUrl = imageUrl || null;
    }

    profile.updatedBy = clerkUserId;
    await profile.save();

    // Update variable values if provided
    if (providedVariables && typeof providedVariables === "object") {
      const variableEntries = Object.entries(providedVariables);
      for (const [key, value] of variableEntries) {
        await VariableValue.setVariable(
          classroomId,
          "profile",
          profile._id,
          key,
          value,
          organizationId,
          clerkUserId
        );
      }

      // Delete variables that are not in the new set
      const existingVariables = await VariableValue.find({
        classroomId,
        appliesTo: "profile",
        ownerId: profile._id,
      });
      const newKeys = new Set(Object.keys(providedVariables));
      for (const existingVar of existingVariables) {
        if (!newKeys.has(existingVar.variableKey)) {
          await VariableValue.deleteOne({ _id: existingVar._id });
        }
      }

      profile.updatedBy = clerkUserId;
      await profile.save();
    }
  }

  // Return profile with variables populated via plugin
  return await this.getStoreByUser(classroomId, userId);
};

// Instance methods

/**
 * Get variables for this profile instance
 * Uses cached variables if available, otherwise loads them
 * @returns {Promise<Object>} Variables object
 */
storeSchema.methods.getVariables = async function () {
  // Use plugin's cached variables or load them (valueMap format)
  return await this._loadVariables();
};

/**
 * Check if profile can be modified
 * @returns {boolean} Always true (profiles can now be updated)
 */
storeSchema.methods.canModify = function () {
  return true;
};

const Profile = mongoose.model("Profile", storeSchema);

module.exports = Profile;
