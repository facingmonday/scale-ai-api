const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const SUPPLY_CHAIN_METRIC_KEYS = [
  "sales",
  "revenue",
  "costs",
  "waste",
  "netProfit",
  "cashBefore",
  "cashAfter",
];
const SUPPLY_CHAIN_LEADERBOARD_KEYS = [
  "netProfit",
  "sales",
  "revenue",
  "costs",
  "waste",
  "cashAfter",
];
const ASCENDING_LEADERBOARD_KEYS = new Set(["costs", "waste"]);

/**
 * MetricDefinition - Output definitions for the AI simulation.
 *
 * Where VariableDefinition controls INPUTS (entered by humans via form widgets),
 * MetricDefinition controls OUTPUTS that the AI computes and the UI displays.
 *
 * Each classroom defines its own set of metrics. The AI engine builds its
 * JSON response schema dynamically from these definitions, and the web UI
 * renders tables, KPIs, charts, and leaderboards from them.
 */
const metricDefinitionSchema = new mongoose.Schema({
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
  dataType: {
    type: String,
    enum: ["number", "string", "boolean"],
    required: true,
  },
  // How the value should be formatted in the UI
  format: {
    type: String,
    enum: ["currency", "count", "units", "percent", "text"],
    default: "count",
  },
  // Instruction to the AI on how to compute this metric (carry-forward behavior,
  // allowed range, formula hints, etc.). This is included in both the JSON schema
  // description and the prompt envelope so the AI has explicit per-metric guidance.
  aiPromptRule: {
    type: String,
    default: "",
  },
  // How values aggregate across multiple ledger entries (used by charts/leaderboards)
  aggregation: {
    type: String,
    enum: ["sum", "avg", "last", "max", "min", "none"],
    default: "last",
  },
  // Which UI surfaces should show this metric
  displayIn: {
    table: { type: Boolean, default: true },
    kpi: { type: Boolean, default: false },
    chart: { type: Boolean, default: false },
    leaderboard: { type: Boolean, default: false },
    detail: { type: Boolean, default: true },
  },
  // Optional initial value used to seed the "Week 0" LedgerEntry
  defaultInitialValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  // Soft delete flag
  isActive: {
    type: Boolean,
    default: true,
  },
}).add(baseSchema);

// All definitions are classroom-scoped: unique on organization + classroomId + key
metricDefinitionSchema.index(
  { organization: 1, classroomId: 1, key: 1 },
  { unique: true, sparse: true }
);
metricDefinitionSchema.index({ classroomId: 1, isActive: 1 });
metricDefinitionSchema.index({ organization: 1, classroomId: 1 });

// Static methods

/**
 * Create a metric definition
 */
metricDefinitionSchema.statics.createDefinition = async function (
  classroomId,
  payload,
  organizationId,
  clerkUserId
) {
  if (!classroomId) {
    throw new Error("classroomId is required");
  }
  if (!payload.key) {
    throw new Error("key is required");
  }
  if (!payload.label) {
    throw new Error("label is required");
  }
  if (!payload.dataType) {
    throw new Error("dataType is required");
  }

  const existing = await this.findOne({
    organization: organizationId,
    classroomId,
    key: payload.key,
  });

  if (existing) {
    throw new Error(
      `Metric definition with key "${payload.key}" already exists for this class`
    );
  }

  const definition = new this({
    classroomId,
    key: payload.key,
    label: payload.label,
    description: payload.description || "",
    dataType: payload.dataType,
    format: payload.format || "count",
    aiPromptRule: payload.aiPromptRule || "",
    aggregation: payload.aggregation || "last",
    displayIn: {
      table: payload.displayIn?.table !== false,
      kpi: !!payload.displayIn?.kpi,
      chart: !!payload.displayIn?.chart,
      leaderboard: !!payload.displayIn?.leaderboard,
      detail: payload.displayIn?.detail !== false,
    },
    defaultInitialValue:
      payload.defaultInitialValue !== undefined
        ? payload.defaultInitialValue
        : null,
    sortOrder: payload.sortOrder ?? 0,
    isActive: true,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await definition.save();
  return definition;
};

/**
 * Get all metric definitions for a class
 */
metricDefinitionSchema.statics.getDefinitionsForClassroom = async function (
  classroomId,
  options = {}
) {
  if (!classroomId) {
    throw new Error("classroomId is required");
  }
  const query = { classroomId };
  if (!options.includeInactive) {
    query.isActive = true;
  }
  return await this.find(query).sort({ sortOrder: 1, label: 1 });
};

/**
 * Get only the active metric definitions for a class, sorted by sortOrder/label.
 * Used by the AI engine to build the response JSON schema and prompt envelope.
 */
metricDefinitionSchema.statics.getActive = async function (classroomId) {
  return await this.getDefinitionsForClassroom(classroomId, {
    includeInactive: false,
  });
};

/**
 * Select the single metric used to rank results. Supply-chain classrooms use
 * net profit even when legacy definitions still flag revenue and cash balance.
 * Other classroom types retain their configured leaderboard metric.
 */
metricDefinitionSchema.statics.selectLeaderboardDefinition = function (
  definitions
) {
  const numericDefs = (Array.isArray(definitions) ? definitions : []).filter(
    (definition) =>
      definition &&
      definition.dataType === "number" &&
      definition.isActive !== false
  );
  const keys = new Set(numericDefs.map((definition) => definition.key));
  const isSupplyChainLedger = SUPPLY_CHAIN_METRIC_KEYS.every((key) =>
    keys.has(key)
  );

  if (isSupplyChainLedger) {
    return numericDefs.find((definition) => definition.key === "netProfit");
  }

  return (
    numericDefs.find((definition) => definition.displayIn?.leaderboard) ||
    numericDefs[0] ||
    null
  );
};

/**
 * Select the metrics displayed by the cumulative instructor leaderboard.
 * Supply-chain classrooms always use the six canonical categories in product
 * order. Other classroom types retain their configured leaderboard metrics.
 */
metricDefinitionSchema.statics.selectLeaderboardDefinitions = function (
  definitions
) {
  const numericDefs = (Array.isArray(definitions) ? definitions : []).filter(
    (definition) =>
      definition &&
      definition.dataType === "number" &&
      definition.isActive !== false
  );
  const definitionsByKey = new Map(
    numericDefs.map((definition) => [definition.key, definition])
  );
  const isSupplyChainLedger = SUPPLY_CHAIN_METRIC_KEYS.every((key) =>
    definitionsByKey.has(key)
  );

  const selected = isSupplyChainLedger
    ? SUPPLY_CHAIN_LEADERBOARD_KEYS.map((key) => definitionsByKey.get(key))
    : numericDefs.filter((definition) => definition.displayIn?.leaderboard);

  return selected.filter(Boolean).map((definition) => ({
    definition,
    direction: ASCENDING_LEADERBOARD_KEYS.has(definition.key) ? "asc" : "desc",
  }));
};

/**
 * Idempotently enables the canonical six leaderboard metrics for existing
 * supply-chain classrooms. Only classrooms whose complete active numeric
 * metric set exactly matches the canonical ledger are eligible.
 */
metricDefinitionSchema.statics.repairSupplyChainLeaderboardFlagsForOrganization =
  async function (organizationId, clerkUserId = "system_startup") {
    if (!organizationId) throw new Error("organizationId is required");

    const definitions = await this.find({
      organization: organizationId,
      isActive: true,
      dataType: "number",
    })
      .select("_id classroomId key displayIn.leaderboard")
      .lean();
    const byClassroom = new Map();
    definitions.forEach((definition) => {
      const classroomKey = String(definition.classroomId);
      if (!byClassroom.has(classroomKey)) byClassroom.set(classroomKey, []);
      byClassroom.get(classroomKey).push(definition);
    });

    const canonicalKeySet = new Set(SUPPLY_CHAIN_METRIC_KEYS);
    const classroomIds = [];
    byClassroom.forEach((classroomDefinitions, classroomId) => {
      const keys = new Set(classroomDefinitions.map(({ key }) => key));
      if (
        keys.size === canonicalKeySet.size &&
        SUPPLY_CHAIN_METRIC_KEYS.every((key) => keys.has(key))
      ) {
        const needsRepair = classroomDefinitions.some((definition) => {
          const expected = SUPPLY_CHAIN_LEADERBOARD_KEYS.includes(
            definition.key
          );
          return definition.displayIn?.leaderboard !== expected;
        });
        if (needsRepair) classroomIds.push(classroomId);
      }
    });

    if (classroomIds.length === 0) {
      return { classroomsRepaired: 0, metricsUpdated: 0 };
    }

    const leaderboardResult = await this.updateMany(
      {
        organization: organizationId,
        classroomId: { $in: classroomIds },
        key: { $in: SUPPLY_CHAIN_LEADERBOARD_KEYS },
        "displayIn.leaderboard": { $ne: true },
      },
      {
        $set: {
          "displayIn.leaderboard": true,
          updatedBy: clerkUserId,
          updatedDate: new Date(),
        },
      }
    );
    const cashBeforeResult = await this.updateMany(
      {
        organization: organizationId,
        classroomId: { $in: classroomIds },
        key: "cashBefore",
        "displayIn.leaderboard": { $ne: false },
      },
      {
        $set: {
          "displayIn.leaderboard": false,
          updatedBy: clerkUserId,
          updatedDate: new Date(),
        },
      }
    );

    const metricsUpdated =
      (leaderboardResult.modifiedCount || 0) +
      (cashBeforeResult.modifiedCount || 0);
    return {
      classroomsRepaired: classroomIds.length,
      metricsUpdated,
    };
  };

/**
 * Get the set of active metric keys for a classroom.
 */
metricDefinitionSchema.statics.getActiveKeys = async function (classroomId) {
  const defs = await this.getActive(classroomId);
  return new Set(defs.map((d) => d.key));
};

/**
 * Get a definition by key
 */
metricDefinitionSchema.statics.getDefinitionByKey = async function (
  classroomId,
  key
) {
  if (!classroomId) {
    throw new Error("classroomId is required");
  }
  return await this.findOne({ classroomId, key });
};

// Instance methods

metricDefinitionSchema.methods.softDelete = async function () {
  this.isActive = false;
  this.updatedBy = this.updatedBy || this.createdBy;
  await this.save();
  return this;
};

metricDefinitionSchema.methods.restore = async function (clerkUserId) {
  this.isActive = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

const MetricDefinition = mongoose.model(
  "MetricDefinition",
  metricDefinitionSchema
);

module.exports = MetricDefinition;
