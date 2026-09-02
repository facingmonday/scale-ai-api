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
const SUPPLY_CHAIN_ASCENDING_KEYS = ["costs", "waste"];

/**
 * @openapi
 * components:
 *   schemas:
 *     MetricDefinition:
 *       type: object
 *       properties:
 *         classroomId:
 *           type: string
 *         key:
 *           type: string
 *         label:
 *           type: string
 *         dataType:
 *           type: string
 *           enum: [number, string, boolean]
 *         format:
 *           type: string
 *           enum: [currency, count, units, percent, text]
 *         aggregation:
 *           type: string
 *           enum: [sum, avg, last, max, min, none]
 *         displayIn:
 *           type: object
 *           properties:
 *             leaderboard:
 *               type: boolean
 *         leaderboardSortDirection:
 *           type: string
 *           enum: [asc, desc]
 *         isPrimaryLeaderboardMetric:
 *           type: boolean
 *         sortOrder:
 *           type: number
 *         isActive:
 *           type: boolean
 */

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
  // Direction used to rank the aggregated value on leaderboards.
  leaderboardSortDirection: {
    type: String,
    enum: ["asc", "desc"],
    default: "desc",
  },
  // The one leaderboard metric used by singular rank/debrief surfaces.
  isPrimaryLeaderboardMetric: { type: Boolean, default: false },
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
    leaderboardSortDirection:
      payload.leaderboardSortDirection === "asc" ? "asc" : "desc",
    isPrimaryLeaderboardMetric: !!payload.isPrimaryLeaderboardMetric,
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
    isActive: payload.isActive !== false,
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

function isLeaderboardEligible(definition) {
  return !!(
    definition &&
    definition.dataType === "number" &&
    definition.isActive !== false &&
    definition.displayIn?.leaderboard
  );
}

function sortLeaderboardDefinitions(definitions) {
  return [...definitions].sort((a, b) => {
    const orderDifference = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (orderDifference !== 0) return orderDifference;
    return String(a.label || a.key).localeCompare(String(b.label || b.key));
  });
}

/** Select the configured primary metric used by singular ranking surfaces. */
metricDefinitionSchema.statics.selectLeaderboardDefinition = function (
  definitions
) {
  const eligible = sortLeaderboardDefinitions(
    (Array.isArray(definitions) ? definitions : []).filter(
      isLeaderboardEligible
    )
  );
  return (
    eligible.find((definition) => definition.isPrimaryLeaderboardMetric) ||
    eligible[0] ||
    null
  );
};

/** Select every configured leaderboard metric in display order. */
metricDefinitionSchema.statics.selectLeaderboardDefinitions = function (
  definitions
) {
  const selected = sortLeaderboardDefinitions(
    (Array.isArray(definitions) ? definitions : []).filter(
      isLeaderboardEligible
    )
  );
  return selected.map((definition) => ({
    definition,
    direction:
      definition.leaderboardSortDirection === "asc" ? "asc" : "desc",
  }));
};

/**
 * Ensure an enabled classroom has exactly one primary leaderboard metric.
 * preferredKey is used when an administrator explicitly selects a primary.
 */
metricDefinitionSchema.statics.ensurePrimaryLeaderboardMetric = async function (
  classroomId,
  organizationId,
  preferredKey,
  clerkUserId = "system"
) {
  const definitions = await this.find({
    classroomId,
    organization: organizationId,
    isActive: true,
    dataType: "number",
    "displayIn.leaderboard": true,
  }).sort({ sortOrder: 1, label: 1 });

  if (definitions.length === 0) {
    await this.updateMany(
      { classroomId, organization: organizationId, isPrimaryLeaderboardMetric: true },
      {
        $set: {
          isPrimaryLeaderboardMetric: false,
          updatedBy: clerkUserId,
          updatedDate: new Date(),
        },
      }
    );
    return null;
  }

  const target =
    definitions.find((definition) => definition.key === preferredKey) ||
    definitions.find((definition) => definition.isPrimaryLeaderboardMetric) ||
    definitions[0];

  await this.updateMany(
    {
      classroomId,
      organization: organizationId,
      _id: { $ne: target._id },
      isPrimaryLeaderboardMetric: true,
    },
    {
      $set: {
        isPrimaryLeaderboardMetric: false,
        updatedBy: clerkUserId,
        updatedDate: new Date(),
      },
    }
  );
  if (!target.isPrimaryLeaderboardMetric) {
    target.isPrimaryLeaderboardMetric = true;
    target.updatedBy = clerkUserId;
    await target.save();
  }
  return target;
};

/**
 * Backfill missing leaderboard fields without changing administrator-authored
 * display flags, aggregation behavior, formats, or existing sort directions.
 */
metricDefinitionSchema.statics.backfillLeaderboardConfigurationForOrganization =
  async function (organizationId, clerkUserId = "system_startup") {
    if (!organizationId) throw new Error("organizationId is required");

    const definitions = await this.find({
      organization: organizationId,
      isActive: true,
      dataType: "number",
    })
      .select(
        "_id classroomId key label dataType isActive sortOrder displayIn leaderboardSortDirection isPrimaryLeaderboardMetric"
      )
      .lean();
    const byClassroom = new Map();
    definitions.forEach((definition) => {
      const classroomKey = String(definition.classroomId);
      if (!byClassroom.has(classroomKey)) byClassroom.set(classroomKey, []);
      byClassroom.get(classroomKey).push(definition);
    });

    const canonicalClassroomIds = [];
    byClassroom.forEach((classroomDefinitions, classroomId) => {
      const keys = new Set(classroomDefinitions.map(({ key }) => key));
      if (
        keys.size === SUPPLY_CHAIN_METRIC_KEYS.length &&
        SUPPLY_CHAIN_METRIC_KEYS.every((key) => keys.has(key))
      ) {
        canonicalClassroomIds.push(classroomId);
      }
    });

    const ascendingResult = await this.updateMany(
      {
        organization: organizationId,
        classroomId: { $in: canonicalClassroomIds },
        key: { $in: SUPPLY_CHAIN_ASCENDING_KEYS },
        leaderboardSortDirection: { $exists: false },
      },
      {
        $set: {
          leaderboardSortDirection: "asc",
          updatedBy: clerkUserId,
          updatedDate: new Date(),
        },
      }
    );
    const defaultsResult = await this.updateMany(
      {
        organization: organizationId,
        leaderboardSortDirection: { $exists: false },
      },
      {
        $set: {
          leaderboardSortDirection: "desc",
          updatedBy: clerkUserId,
          updatedDate: new Date(),
        },
      }
    );
    const primaryDefaultsResult = await this.updateMany(
      {
        organization: organizationId,
        isPrimaryLeaderboardMetric: { $exists: false },
      },
      {
        $set: {
          isPrimaryLeaderboardMetric: false,
          updatedBy: clerkUserId,
          updatedDate: new Date(),
        },
      }
    );

    let primariesAssigned = 0;
    for (const [classroomId, classroomDefinitions] of byClassroom) {
      const eligible = sortLeaderboardDefinitions(
        classroomDefinitions.filter(isLeaderboardEligible)
      );
      const allPrimaries = classroomDefinitions.filter(
        (definition) => definition.isPrimaryLeaderboardMetric
      );
      if (eligible.length === 0) {
        if (allPrimaries.length > 0) {
          await this.ensurePrimaryLeaderboardMetric(
            classroomId,
            organizationId,
            undefined,
            clerkUserId
          );
          primariesAssigned += 1;
        }
        continue;
      }
      const primaries = eligible.filter(
        (definition) => definition.isPrimaryLeaderboardMetric
      );
      if (primaries.length === 1 && allPrimaries.length === 1) continue;
      const preferredKey =
        primaries[0]?.key ||
        (canonicalClassroomIds.includes(classroomId)
          ? "netProfit"
          : eligible[0].key);
      await this.ensurePrimaryLeaderboardMetric(
        classroomId,
        organizationId,
        preferredKey,
        clerkUserId
      );
      primariesAssigned += 1;
    }

    return {
      metricsUpdated:
        (ascendingResult.modifiedCount || 0) +
        (defaultsResult.modifiedCount || 0) +
        (primaryDefaultsResult.modifiedCount || 0),
      primariesAssigned,
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
  key,
  organizationId
) {
  if (!classroomId) {
    throw new Error("classroomId is required");
  }
  const query = { classroomId, key };
  if (organizationId) query.organization = organizationId;
  return await this.findOne(query);
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
