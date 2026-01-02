const mongoose = require("mongoose");

const StoreType = require("../storeType/storeType.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const { STORE_TYPE_PRESETS } = require("../store/storeTypePresets");

const classroomTemplateSchema = new mongoose.Schema(
  {
    // null => global template maintained by developers
    // ObjectId => org-owned template copy
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      default: null,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sourceTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassroomTemplate",
      required: false,
      default: null,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Base fields (intentionally *not* requiring organization, unlike baseSchema)
    createdBy: {
      type: String,
      required: true,
    },
    createdDate: Date,
    updatedBy: {
      type: String,
      required: true,
    },
    updatedDate: Date,
  },
  {
    minimize: false,
    timestamps: {
      createdAt: "createdDate",
      updatedAt: "updatedDate",
    },
  }
);

// Allow same key to exist globally and per org
classroomTemplateSchema.index(
  { organization: 1, key: 1 },
  { unique: true, sparse: true }
);
classroomTemplateSchema.index({ organization: 1, isActive: 1 });

// ----------------------------
// Default builder statics
// ----------------------------

/**
 * Default submission variable definitions (template blueprint).
 * Sourced from prior Classroom seed builder.
 */
classroomTemplateSchema.statics.getDefaultSubmissionVariableDefinitions =
  function () {
    return [
      {
        key: "demandForecastOverride",
        label: "Demand Forecast Adjustment",
        description:
          "Adjust expected demand relative to the baseline forecast. Positive values assume higher demand. Negative values assume lower demand.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        min: -30,
        max: 30,
        defaultValue: 0,
        required: true,
      },
      {
        key: "demandCommitmentLevel",
        label: "Demand Commitment Level",
        description:
          "How strongly you commit inventory decisions to forecasted demand. Aggressive commitments increase stockout risk if demand misses.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "dropdown",
        options: ["CONSERVATIVE", "EXPECTED", "AGGRESSIVE"],
        defaultValue: "EXPECTED",
        required: true,
      },
      {
        key: "reorderPolicy",
        label: "Reorder Policy",
        description:
          "Defines when inventory is reordered. Different policies trade holding cost for stockout risk.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "dropdown",
        options: ["FIXED_INTERVAL", "REORDER_POINT", "DEMAND_TRIGGERED"],
        defaultValue: "REORDER_POINT",
        required: true,
      },
      {
        key: "reorderPointRefrigeratedPercent",
        label: "Cold Storage Reorder Point (%)",
        description:
          "Triggers a refrigerated inventory reorder when stock falls below this percentage of capacity. Higher values reduce stockouts but increase holding cost.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        min: 0,
        max: 50,
        defaultValue: 20,
        required: true,
      },
      {
        key: "reorderPointAmbientPercent",
        label: "Ambient Inventory Reorder Point (%)",
        description:
          "Triggers an ambient inventory reorder when stock falls below this percentage of capacity. Lower values save cost but increase risk of stockouts.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        min: 0,
        max: 50,
        defaultValue: 15,
        required: true,
      },
      {
        key: "reorderPointNotForResalePercent",
        label: "Ops Supply Reorder Point (%)",
        description:
          "Triggers a reorder for non-resale operating supplies. Running out of ops supplies can limit production capacity.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        min: 0,
        max: 50,
        defaultValue: 10,
        required: true,
      },
      {
        key: "safetyStockByBucketStrategy",
        label: "Safety Stock Strategy",
        description:
          "Controls how much buffer inventory is carried across all buckets. Higher safety stock improves service level but raises holding cost.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "dropdown",
        options: ["LOW", "BALANCED", "HIGH"],
        defaultValue: "BALANCED",
        required: true,
      },
      {
        key: "inventoryProtectionPriority",
        label: "Inventory Protection Priority",
        description:
          "Determines which inventory bucket is prioritized when capacity, cash, or supply is constrained. Affects which inventory is replenished or sacrificed first.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "dropdown",
        options: ["REFRIGERATED_FIRST", "AMBIENT_FIRST", "BALANCED"],
        defaultValue: "BALANCED",
        required: true,
      },
      {
        key: "allowExpediteOrders",
        label: "Allow Expedited Orders",
        description:
          "Allows emergency replenishment at a higher cost. Expediting avoids stockouts but significantly increases costs.",
        appliesTo: "submission",
        dataType: "boolean",
        inputType: "switch",
        defaultValue: false,
        required: false,
      },
      {
        key: "plannedProductionUnits",
        label: "Planned Production Units",
        description:
          "Target number of units to produce this period. Production is limited by inventory, labor, and capacity.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        min: 0,
        max: 1000,
        defaultValue: 0,
        required: true,
      },
      {
        key: "staffingLevel",
        label: "Staffing Level",
        description:
          "Adjust staffing relative to baseline requirements. Higher staffing increases cost but improves throughput.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "dropdown",
        options: ["BELOW_AVERAGE", "AVERAGE", "ABOVE_AVERAGE"],
        defaultValue: "AVERAGE",
        required: true,
      },
      {
        key: "inventoryConsumptionDiscipline",
        label: "Inventory Consumption Discipline",
        description:
          "Controls how strictly inventory rotation rules are followed. Loose discipline can increase waste, especially in cold storage.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "dropdown",
        options: ["FIFO_STRICT", "FIFO_LOOSE", "OPPORTUNISTIC"],
        defaultValue: "FIFO_STRICT",
        required: true,
      },
      {
        key: "unitSalePrice",
        label: "Unit Sale Price",
        description:
          "Price charged per unit sold. Higher prices increase margin but may reduce demand.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "number",
        min: 0,
        defaultValue: 0,
        required: true,
      },
      {
        key: "discountIntensity",
        label: "Discount Intensity (%)",
        description:
          "Percentage discount applied to unit price. Discounts increase volume but reduce margin.",
        appliesTo: "submission",
        dataType: "number",
        inputType: "slider",
        min: 0,
        max: 50,
        defaultValue: 0,
        required: false,
      },
      {
        key: "priceElasticitySensitivity",
        label: "Price Sensitivity",
        description:
          "How strongly demand responds to price changes. High sensitivity means price increases quickly reduce demand.",
        appliesTo: "submission",
        dataType: "string",
        inputType: "dropdown",
        options: ["LOW", "MEDIUM", "HIGH"],
        defaultValue: "MEDIUM",
        required: true,
      },
    ];
  };

/**
 * Default storeType variable definitions (template blueprint).
 * Sourced from prior Classroom seed builder.
 */
classroomTemplateSchema.statics.getDefaultStoreTypeVariableDefinitions =
  function () {
    return [
      {
        key: "capacity-units-refrigerated",
        label: "Capacity Units (Refrigerated)",
        description: "Maximum cold storage capacity in abstract inventory units.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 40,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "starting-units-refrigerated",
        label: "Starting Inventory Units (Refrigerated)",
        description: "Initial refrigerated inventory units available at store start.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 24,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "goods-per-unit-refrigerated",
        label: "Goods per Unit (Refrigerated)",
        description:
          "Number of finished goods supported by one refrigerated inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 2.5,
        min: 0.1,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "avg-unit-cost-refrigerated",
        label: "Avg Unit Cost (Refrigerated)",
        description: "Average dollar value of one refrigerated inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 9.5,
        min: 0,
        max: 1000,
        required: true,
        isActive: true,
      },
      {
        key: "holding-cost-per-unit-refrigerated",
        label: "Holding Cost per Unit per Week (Refrigerated)",
        description: "Weekly cost to hold one refrigerated inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 0.75,
        min: 0,
        max: 50,
        required: true,
        isActive: true,
      },
      {
        key: "capacity-units-ambient",
        label: "Capacity Units (Ambient)",
        description:
          "Maximum dry or shelf storage capacity in abstract inventory units.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 80,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "starting-units-ambient",
        label: "Starting Inventory Units (Ambient)",
        description: "Initial ambient inventory units available at store start.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 45,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "goods-per-unit-ambient",
        label: "Goods per Unit (Ambient)",
        description: "Number of finished goods supported by one ambient inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 5,
        min: 0.1,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "avg-unit-cost-ambient",
        label: "Avg Unit Cost (Ambient)",
        description: "Average dollar value of one ambient inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 4.25,
        min: 0,
        max: 1000,
        required: true,
        isActive: true,
      },
      {
        key: "holding-cost-per-unit-ambient",
        label: "Holding Cost per Unit per Week (Ambient)",
        description: "Weekly cost to hold one ambient inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 0.25,
        min: 0,
        max: 50,
        required: true,
        isActive: true,
      },
      {
        key: "capacity-units-operating-supply",
        label: "Capacity Units (Operating Supplies)",
        description:
          "Maximum capacity for non-resale operating supplies such as packaging and disposables.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 60,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "starting-units-operating-supply",
        label: "Starting Inventory Units (Operating Supplies)",
        description:
          "Initial operating supply inventory units available at store start.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 35,
        min: 0,
        max: 500,
        required: true,
        isActive: true,
      },
      {
        key: "goods-per-unit-operating-supply",
        label: "Goods per Unit (Operating Supplies)",
        description:
          "Number of finished goods supported by one operating supply unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 12,
        min: 0.1,
        max: 100,
        required: true,
        isActive: true,
      },
      {
        key: "avg-unit-cost-operating-supply",
        label: "Avg Unit Cost (Operating Supplies)",
        description: "Average dollar value of one operating supply inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 1.75,
        min: 0,
        max: 1000,
        required: true,
        isActive: true,
      },
      {
        key: "holding-cost-per-unit-operating-supply",
        label: "Holding Cost per Unit per Week (Operating Supplies)",
        description: "Weekly cost to hold one operating supply inventory unit.",
        appliesTo: "storeType",
        dataType: "number",
        inputType: "number",
        options: [],
        defaultValue: 0.15,
        min: 0,
        max: 50,
        required: true,
        isActive: true,
      },
    ];
  };

// ----------------------------
// Template lifecycle statics
// ----------------------------

classroomTemplateSchema.statics.GLOBAL_DEFAULT_KEY = "default_supply_chain_101";

classroomTemplateSchema.statics.ensureGlobalDefaultTemplate = async function () {
  const key = this.GLOBAL_DEFAULT_KEY;
  const existing = await this.findOne({ organization: null, key }).select("_id");
  if (existing) return existing;

  const payload = {
    storeTypes: Object.keys(STORE_TYPE_PRESETS || {}).map((key) => ({
      key,
      label: STORE_TYPE_PRESETS[key]?.label || key,
      description: STORE_TYPE_PRESETS[key]?.description || "",
      isActive: true,
    })),
    variableDefinitionsByAppliesTo: {
      storeType: this.getDefaultStoreTypeVariableDefinitions(),
      store: [],
      submission: this.getDefaultSubmissionVariableDefinitions(),
      scenario: [],
    },
    storeTypeValuesByStoreTypeKey: {},
  };

  const doc = new this({
    organization: null,
    key,
    label: "Supply Chain 101 (Default)",
    description:
      "Default developer-managed template for SCALE.ai Supply Chain 101 simulation.",
    isActive: true,
    version: 1,
    payload,
    createdBy: "system_startup",
    updatedBy: "system_startup",
  });

  await doc.save();
  return doc;
};

classroomTemplateSchema.statics.copyGlobalToOrganization = async function (
  organizationId,
  clerkUserId
) {
  const globalTemplate = await this.ensureGlobalDefaultTemplate();
  const existingOrgTemplate = await this.findOne({
    organization: organizationId,
    key: globalTemplate.key,
  }).select("_id");
  if (existingOrgTemplate) return existingOrgTemplate;

  const orgTemplate = new this({
    organization: organizationId,
    key: globalTemplate.key,
    label: globalTemplate.label,
    description: globalTemplate.description,
    version: globalTemplate.version,
    isActive: true,
    sourceTemplateId: globalTemplate._id,
    payload: globalTemplate.payload,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await orgTemplate.save();
  return orgTemplate;
};

// ----------------------------
// Apply template to classroom
// ----------------------------

function normalizeVariableDefinitionsByAppliesTo(payload) {
  const src = payload?.variableDefinitionsByAppliesTo || {};
  return {
    storeType: Array.isArray(src.storeType) ? src.storeType : [],
    store: Array.isArray(src.store) ? src.store : [],
    submission: Array.isArray(src.submission) ? src.submission : [],
    scenario: Array.isArray(src.scenario) ? src.scenario : [],
  };
}

classroomTemplateSchema.methods.applyToClassroom = async function ({
  classroomId,
  organizationId,
  clerkUserId,
}) {
  if (!classroomId) throw new Error("classroomId is required");
  if (!organizationId) throw new Error("organizationId is required");

  const stats = {
    storeTypesCreated: 0,
    storeTypesSkipped: 0,
    variableDefinitionsCreated: 0,
    variableDefinitionsSkipped: 0,
    variableValuesCreated: 0,
    variableValuesSkipped: 0,
  };

  const payload = this.payload || {};
  const defsByScope = normalizeVariableDefinitionsByAppliesTo(payload);
  const storeTypesPayload = Array.isArray(payload.storeTypes) ? payload.storeTypes : [];
  const storeTypeValuesByKey =
    payload.storeTypeValuesByStoreTypeKey &&
    typeof payload.storeTypeValuesByStoreTypeKey === "object"
      ? payload.storeTypeValuesByStoreTypeKey
      : {};

  // 1) Create StoreTypes (classroom-scoped)
  const storeTypeDocs = [];
  for (const st of storeTypesPayload) {
    if (!st || !st.key) continue;
    const existing = await StoreType.findOne({
      organization: organizationId,
      classroomId,
      key: st.key,
    }).select("_id");
    if (existing) {
      stats.storeTypesSkipped += 1;
      continue;
    }

    const doc = new StoreType({
      organization: organizationId,
      classroomId,
      key: st.key,
      label: st.label || st.key,
      description: st.description || "",
      isActive: st.isActive !== false,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    await doc.save();
    storeTypeDocs.push(doc);
    stats.storeTypesCreated += 1;
  }

  // If template didn't include store types, we still may want values/defs; store types are required for values.
  const allStoreTypesInClass = storeTypeDocs.length
    ? storeTypeDocs
    : await StoreType.find({ organization: organizationId, classroomId, isActive: true });

  // 2) Create VariableDefinitions (classroom-scoped, create-only)
  const allDefs = [
    ...defsByScope.storeType,
    ...defsByScope.store,
    ...defsByScope.submission,
    ...defsByScope.scenario,
  ];

  for (const def of allDefs) {
    if (!def || !def.key || !def.appliesTo) continue;
    const exists = await VariableDefinition.findOne({
      organization: organizationId,
      classroomId,
      appliesTo: def.appliesTo,
      key: def.key,
    }).select("_id");

    if (exists) {
      stats.variableDefinitionsSkipped += 1;
      continue;
    }

    await VariableDefinition.createDefinition(classroomId, def, organizationId, clerkUserId);
    stats.variableDefinitionsCreated += 1;
  }

  // 3) Create storeType VariableValues for each storeType × storeType definition (create-only)
  const storeTypeDefs = defsByScope.storeType;
  if (allStoreTypesInClass.length > 0 && storeTypeDefs.length > 0) {
    const storeTypeIds = allStoreTypesInClass.map((s) => s._id);
    const defKeys = storeTypeDefs.map((d) => d.key);

    const existing = await VariableValue.find({
      organization: organizationId,
      classroomId,
      appliesTo: "storeType",
      ownerId: { $in: storeTypeIds },
      variableKey: { $in: defKeys },
    }).select("ownerId variableKey");

    const existingSet = new Set(
      (existing || []).map((v) => `${v.ownerId.toString()}::${v.variableKey}`)
    );

    const ops = [];
    for (const st of allStoreTypesInClass) {
      const overrideMap =
        storeTypeValuesByKey && storeTypeValuesByKey[st.key]
          ? storeTypeValuesByKey[st.key]
          : null;

      for (const def of storeTypeDefs) {
        const compound = `${st._id.toString()}::${def.key}`;
        if (existingSet.has(compound)) {
          stats.variableValuesSkipped += 1;
          continue;
        }

        const value =
          overrideMap && overrideMap[def.key] !== undefined
            ? overrideMap[def.key]
            : def.defaultValue;

        ops.push({
          insertOne: {
            document: {
              organization: organizationId,
              classroomId,
              appliesTo: "storeType",
              ownerId: st._id,
              variableKey: def.key,
              value,
              createdBy: clerkUserId,
              updatedBy: clerkUserId,
            },
          },
        });
      }
    }

    if (ops.length > 0) {
      const res = await VariableValue.bulkWrite(ops, { ordered: false });
      stats.variableValuesCreated += res?.insertedCount || 0;
    }
  }

  return stats;
};

const ClassroomTemplate = mongoose.model("ClassroomTemplate", classroomTemplateSchema);

module.exports = ClassroomTemplate;


