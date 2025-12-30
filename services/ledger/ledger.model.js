const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const ledgerEntrySchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: false,
    default: null,
  },
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Submission",
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  sales: {
    type: Number,
    required: true,
    min: 0,
  },
  revenue: {
    type: Number,
    required: true,
  },
  costs: {
    type: Number,
    required: true,
    min: 0,
  },
  waste: {
    type: Number,
    required: true,
    min: 0,
  },
  cashBefore: {
    type: Number,
    required: true,
  },
  cashAfter: {
    type: Number,
    required: true,
  },
  inventoryBefore: {
    type: Number,
    required: true,
    min: 0,
  },
  inventoryAfter: {
    type: Number,
    required: true,
    min: 0,
  },
  netProfit: {
    type: Number,
    required: true,
  },
  randomEvent: {
    type: String,
    default: null,
  },
  summary: {
    type: String,
    required: true,
  },
  // AI-calculated educational / explainability metrics for teaching purposes
  // (Kept schema-light; validated via AI JSON schema + app-level checks)
  education: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  aiMetadata: {
    model: {
      type: String,
      required: true,
    },
    runId: {
      type: String,
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  calculationContext: {
    // Store variables at time of calculation
    storeVariables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Scenario variables
    scenarioVariables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Submission variables (student decisions)
    submissionVariables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Outcome variables
    outcomeVariables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Prior ledger state
    priorState: {
      cashBefore: Number,
      inventoryBefore: Number,
      ledgerHistory: [
        {
          scenarioId: mongoose.Schema.Types.ObjectId,
          scenarioTitle: String,
          netProfit: Number,
          cashAfter: Number,
        },
      ],
    },
    // Full prompt sent to OpenAI (stored as stringified JSON)
    prompt: {
      type: String,
      default: null,
    },
  },
  overridden: {
    type: Boolean,
    default: false,
  },
  overriddenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    default: null,
  },
  overriddenAt: {
    type: Date,
    default: null,
  },
}).add(baseSchema);

// Compound indexes for performance
// Sparse unique index for scenario-based entries (only applies when scenarioId exists)
ledgerEntrySchema.index(
  { scenarioId: 1, userId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { scenarioId: { $ne: null } },
  }
);
// Unique index for initial entries (where scenarioId is null)
ledgerEntrySchema.index(
  { classroomId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { scenarioId: null },
  }
);
ledgerEntrySchema.index({ classroomId: 1, userId: 1, createdDate: 1 });
ledgerEntrySchema.index({ scenarioId: 1 });
ledgerEntrySchema.index({ organization: 1, scenarioId: 1 });
ledgerEntrySchema.index({ organization: 1, classroomId: 1, userId: 1 });
ledgerEntrySchema.index({ submissionId: 1 });

// Validation: cashAfter must equal cashBefore + netProfit
ledgerEntrySchema.pre("save", function (next) {
  const expectedCashAfter = this.cashBefore + this.netProfit;
  if (Math.abs(this.cashAfter - expectedCashAfter) > 0.01) {
    return next(
      new Error(
        `Cash continuity error: cashAfter (${this.cashAfter}) must equal cashBefore (${this.cashBefore}) + netProfit (${this.netProfit})`
      )
    );
  }
  next();
});

// Static methods

/**
 * Get the OpenAI JSON schema for an AI-generated scenario ledger entry payload.
 *
 * Notes:
 * - This schema describes the AI response payload (NOT the full Mongo document).
 * - aiMetadata + calculationContext are added by the application after the AI responds.
 * - Keep this in sync with how SimulationWorker writes ledger entries.
 *
 * @returns {Object} JSON schema object for OpenAI response_format.json_schema.schema
 */
ledgerEntrySchema.statics.getAISimulationResponseJsonSchema = function () {
  return {
    type: "object",
    required: [
      "sales",
      "revenue",
      "costs",
      "waste",
      "cashBefore",
      "cashAfter",
      "inventoryBefore",
      "inventoryAfter",
      "netProfit",
      "randomEvent",
      "summary",
      "education",
    ],
    properties: {
      sales: { type: "number" },
      revenue: { type: "number" },
      costs: { type: "number" },
      waste: { type: "number" },
      cashBefore: { type: "number" },
      cashAfter: { type: "number" },
      inventoryBefore: { type: "number" },
      inventoryAfter: { type: "number" },
      netProfit: { type: "number" },
      randomEvent: { type: ["string", "null"] },
      summary: { type: "string" },
      education: {
        type: "object",
        required: [
          "demandForecast",
          "demandActual",
          "serviceLevel",
          "fillRate",
          "stockoutUnits",
          "lostSalesUnits",
          "backorderUnits",
          "materialFlowByBucket",
          "costBreakdown",
          "teachingNotes",
        ],
        properties: {
          demandForecast: { type: "number" },
          demandActual: { type: "number" },
          serviceLevel: { type: "number" },
          fillRate: { type: "number" },
          stockoutUnits: { type: "number" },
          lostSalesUnits: { type: "number" },
          backorderUnits: { type: "number" },
          materialFlowByBucket: {
            type: "object",
            required: ["refrigerated", "ambient", "notForResaleDry"],
            properties: {
              refrigerated: {
                type: "object",
                required: [
                  "beginUnits",
                  "receivedUnits",
                  "usedUnits",
                  "wasteUnits",
                  "endUnits",
                ],
                properties: {
                  beginUnits: { type: "number" },
                  receivedUnits: { type: "number" },
                  usedUnits: { type: "number" },
                  wasteUnits: { type: "number" },
                  endUnits: { type: "number" },
                },
              },
              ambient: {
                type: "object",
                required: [
                  "beginUnits",
                  "receivedUnits",
                  "usedUnits",
                  "wasteUnits",
                  "endUnits",
                ],
                properties: {
                  beginUnits: { type: "number" },
                  receivedUnits: { type: "number" },
                  usedUnits: { type: "number" },
                  wasteUnits: { type: "number" },
                  endUnits: { type: "number" },
                },
              },
              notForResaleDry: {
                type: "object",
                required: [
                  "beginUnits",
                  "receivedUnits",
                  "usedUnits",
                  "wasteUnits",
                  "endUnits",
                ],
                properties: {
                  beginUnits: { type: "number" },
                  receivedUnits: { type: "number" },
                  usedUnits: { type: "number" },
                  wasteUnits: { type: "number" },
                  endUnits: { type: "number" },
                },
              },
            },
          },
          costBreakdown: {
            type: "object",
            required: [
              "ingredientCost",
              "laborCost",
              "logisticsCost",
              "tariffCost",
              "holdingCost",
              "overflowStorageCost",
              "expediteCost",
              "wasteDisposalCost",
              "otherCost",
            ],
            properties: {
              ingredientCost: { type: "number" },
              laborCost: { type: "number" },
              logisticsCost: { type: "number" },
              tariffCost: { type: "number" },
              holdingCost: { type: "number" },
              overflowStorageCost: { type: "number" },
              expediteCost: { type: "number" },
              wasteDisposalCost: { type: "number" },
              otherCost: { type: "number" },
            },
          },
          teachingNotes: { type: "string" },
        },
      },
    },
  };
};

/**
 * Create a ledger entry
 * @param {Object} input - Ledger entry data
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created ledger entry
 */
ledgerEntrySchema.statics.createLedgerEntry = async function (
  input,
  organizationId,
  clerkUserId
) {
  // Validate cash continuity
  const expectedCashAfter = input.cashBefore + input.netProfit;
  if (Math.abs(input.cashAfter - expectedCashAfter) > 0.01) {
    throw new Error(
      `Cash continuity error: cashAfter (${input.cashAfter}) must equal cashBefore (${input.cashBefore}) + netProfit (${input.netProfit})`
    );
  }

  // Check if entry already exists
  // For scenario-based entries, check scenarioId + userId
  // For initial entries, check classroomId + userId + scenarioId is null
  let existing;
  if (input.scenarioId) {
    existing = await this.findOne({
      scenarioId: input.scenarioId,
      userId: input.userId,
    });
  } else {
    // Initial entry (no scenarioId)
    existing = await this.findOne({
      classroomId: input.classroomId,
      userId: input.userId,
      scenarioId: null,
    });
  }

  if (existing) {
    const entryType = input.scenarioId ? "scenario" : "initial";
    throw new Error(
      `Ledger entry already exists for this ${entryType} and user. Delete existing entry before creating a new one.`
    );
  }

  const entry = new this({
    classroomId: input.classroomId,
    scenarioId: input.scenarioId || null, // Explicitly set to null if not provided
    submissionId: input.submissionId || null,
    userId: input.userId,
    sales: input.sales,
    revenue: input.revenue,
    costs: input.costs,
    waste: input.waste,
    cashBefore: input.cashBefore,
    cashAfter: input.cashAfter,
    inventoryBefore: input.inventoryBefore,
    inventoryAfter: input.inventoryAfter,
    netProfit: input.netProfit,
    randomEvent: input.randomEvent || null,
    summary: input.summary,
    education: input.education ?? null,
    aiMetadata: {
      model: input.aiMetadata.model,
      runId: input.aiMetadata.runId,
      generatedAt: input.aiMetadata.generatedAt || new Date(),
    },
    calculationContext: input.calculationContext
      ? {
          storeVariables: input.calculationContext.storeVariables || {},
          scenarioVariables: input.calculationContext.scenarioVariables || {},
          submissionVariables:
            input.calculationContext.submissionVariables || {},
          outcomeVariables: input.calculationContext.outcomeVariables || {},
          priorState: input.calculationContext.priorState || {},
          prompt: input.calculationContext.prompt || null,
        }
      : undefined,
    overridden: false,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await entry.save();
  return entry;
};

/**
 * Get ledger history for a user in a class
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @param {string} excludeScenarioId - Optional scenario ID to exclude (for reruns)
 * @returns {Promise<Array>} Ordered list of ledger entries
 */
ledgerEntrySchema.statics.getLedgerHistory = async function (
  classroomId,
  userId,
  excludeScenarioId = null
) {
  const query = { classroomId };
  if (excludeScenarioId) {
    query.scenarioId = { $ne: excludeScenarioId };
  }
  return await this.find(query)
    .sort({ createdDate: 1 })
    .populate({
      path: "scenarioId",
      select: "title",
      options: { strictPopulate: false }, // Allow null values
    });
};

/**
 * Get ledger entry for a specific scenario and user
 * @param {string} scenarioId - Scenario ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Ledger entry or null
 */
ledgerEntrySchema.statics.getLedgerEntry = async function (scenarioId, userId) {
  return await this.findOne({ scenarioId, userId });
};

/**
 * Delete all ledger entries for a scenario (used during reruns)
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Object>} Deletion result
 */
ledgerEntrySchema.statics.deleteLedgerEntriesForScenario = async function (
  scenarioId
) {
  const result = await this.deleteMany({ scenarioId });
  return result;
};

/**
 * Override a ledger entry (admin-only)
 * @param {string} ledgerId - Ledger entry ID
 * @param {Object} patch - Fields to override
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @param {string} adminUserId - Admin member ID for overriddenBy
 * @returns {Promise<Object>} Updated ledger entry
 */
ledgerEntrySchema.statics.overrideLedgerEntry = async function (
  ledgerId,
  patch,
  clerkUserId,
  adminUserId
) {
  const entry = await this.findById(ledgerId);
  if (!entry) {
    throw new Error("Ledger entry not found");
  }

  // Update allowed fields
  const allowedFields = [
    "sales",
    "revenue",
    "costs",
    "waste",
    "cashBefore",
    "cashAfter",
    "inventoryBefore",
    "inventoryAfter",
    "netProfit",
    "randomEvent",
    "summary",
  ];

  allowedFields.forEach((field) => {
    if (patch[field] !== undefined) {
      entry[field] = patch[field];
    }
  });

  // Validate cash continuity after override
  const expectedCashAfter = entry.cashBefore + entry.netProfit;
  if (Math.abs(entry.cashAfter - expectedCashAfter) > 0.01) {
    throw new Error(
      `Cash continuity error: cashAfter (${entry.cashAfter}) must equal cashBefore (${entry.cashBefore}) + netProfit (${entry.netProfit})`
    );
  }

  // Mark as overridden
  entry.overridden = true;
  entry.overriddenBy = adminUserId;
  entry.overriddenAt = new Date();
  entry.updatedBy = clerkUserId;

  await entry.save();
  return entry;
};

/**
 * Get all ledger entries for a scenario
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Array>} Array of ledger entries
 */
ledgerEntrySchema.statics.getLedgerEntriesByScenario = async function (
  scenarioId
) {
  return await this.find({ scenarioId })
    .populate("userId", "_id firstName lastName")
    .sort({ userId: 1 });
};

/**
 * Get first ledger entry for a student in a classroom
 * @param {string} classroomId - Classroom ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} First ledger entry or null
 */
ledgerEntrySchema.statics.getFirstLedgerEntryByStudent = async function (
  classroomId,
  userId
) {
  return this.findOne({
    classroomId,
    userId,
  })
    .sort({ createdDate: 1, _id: 1 })
    .lean()
    .exec();
};

/**
 * Get first ledger entry for a student in a classroom
 * @param {string} classroomId - Classroom ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} First ledger entry or null
 */
ledgerEntrySchema.statics.getLastLedgerEntryByStudent = async function (
  classroomId,
  userId
) {
  return await this.findOne({
    classroomId,
    userId,
  })
    .sort({ createdDate: -1, _id: -1 })
    .lean()
    .exec();
};

/**
 * Get calculation details for a ledger entry with variable definitions
 * @param {string} ledgerId - Ledger entry ID
 * @returns {Promise<Object|null>} Calculation details with variable definitions or null
 */
ledgerEntrySchema.statics.getCalculationDetails = async function (ledgerId) {
  const VariableDefinition = require("../variableDefinition/variableDefinition.model");
  const entry = await this.findById(ledgerId);
  if (!entry) {
    return null;
  }

  // Get variable definitions for the classroom
  const allDefinitions = await VariableDefinition.getDefinitionsByClass(
    entry.classroomId
  );

  // Group definitions by appliesTo
  const definitionsByScope = {
    store: [],
    scenario: [],
    submission: [],
    outcome: [],
  };

  allDefinitions.forEach((def) => {
    if (def.appliesTo in definitionsByScope) {
      definitionsByScope[def.appliesTo].push({
        key: def.key,
        label: def.label,
        description: def.description,
        dataType: def.dataType,
        inputType: def.inputType,
      });
    }
  });

  // Convert Map objects to plain objects for JSON serialization
  const calculationContext = entry.calculationContext
    ? {
        storeVariables: entry.calculationContext.storeVariables
          ? Object.fromEntries(entry.calculationContext.storeVariables)
          : {},
        scenarioVariables: entry.calculationContext.scenarioVariables
          ? Object.fromEntries(entry.calculationContext.scenarioVariables)
          : {},
        submissionVariables: entry.calculationContext.submissionVariables
          ? Object.fromEntries(entry.calculationContext.submissionVariables)
          : {},
        outcomeVariables: entry.calculationContext.outcomeVariables
          ? Object.fromEntries(entry.calculationContext.outcomeVariables)
          : {},
        priorState: entry.calculationContext.priorState || {},
        prompt: entry.calculationContext.prompt || null,
      }
    : null;

  return {
    ledgerEntry: {
      _id: entry._id,
      scenarioId: entry.scenarioId,
      submissionId: entry.submissionId,
      sales: entry.sales,
      revenue: entry.revenue,
      costs: entry.costs,
      waste: entry.waste,
      cashBefore: entry.cashBefore,
      cashAfter: entry.cashAfter,
      inventoryBefore: entry.inventoryBefore,
      inventoryAfter: entry.inventoryAfter,
      netProfit: entry.netProfit,
      randomEvent: entry.randomEvent,
      summary: entry.summary,
      education: entry.education ?? null,
      overridden: entry.overridden,
      createdDate: entry.createdDate,
    },
    calculationContext,
    variableDefinitions: definitionsByScope,
  };
};

/**
 * Get ledger summary/aggregates for a student
 * Returns totals and current state from all ledger entries
 * @param {string} classroomId - Classroom ID
 * @param {string} userId - Member ID
 * @param {string} excludeScenarioId - Optional scenario ID to exclude (for reruns)
 * @returns {Promise<Object>} Aggregated ledger summary
 */

ledgerEntrySchema.statics.getLedgerSummary = async function (
  classroomId,
  userId,
  excludeScenarioId = null
) {
  const matchQuery = {
    classroomId: new mongoose.Types.ObjectId(classroomId),
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (excludeScenarioId) {
    matchQuery.scenarioId = {
      $ne: new mongoose.Types.ObjectId(excludeScenarioId),
    };
  }

  const results = await this.aggregate([
    { $match: matchQuery },
    { $sort: { createdDate: 1, _id: 1 } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$sales" },
        totalRevenue: { $sum: "$revenue" },
        totalCosts: { $sum: "$costs" },
        totalWaste: { $sum: "$waste" },
        totalNetProfit: { $sum: "$netProfit" },
        scenarioCount: {
          $sum: { $cond: [{ $ne: ["$scenarioId", null] }, 1, 0] },
        },
        totalEntries: { $sum: 1 },
        firstEntryDate: { $min: "$createdDate" },
        lastEntryDate: { $max: "$createdDate" },
        lastCashAfter: { $last: "$cashAfter" },
        lastInventoryAfter: { $last: "$inventoryAfter" },
      },
    },
  ]);

  const summary = results[0];

  if (!summary) {
    return {
      totalSales: 0,
      totalRevenue: 0,
      totalCosts: 0,
      totalWaste: 0,
      totalNetProfit: 0,
      scenarioCount: 0,
      totalEntries: 0,
      cashBalance: 0,
      inventory: 0,
      firstEntryDate: null,
      lastEntryDate: null,
      lastScenarioId: null,
    };
  }

  return {
    totalSales: summary.totalSales,
    totalRevenue: summary.totalRevenue,
    totalCosts: summary.totalCosts,
    totalWaste: summary.totalWaste,
    totalNetProfit: summary.totalNetProfit,
    scenarioCount: summary.scenarioCount,
    totalEntries: summary.totalEntries,
    cashBalance: summary.lastCashAfter,
    inventory: summary.lastInventoryAfter,
    firstEntryDate: summary.firstEntryDate,
    lastEntryDate: summary.lastEntryDate,
  };
};

const LedgerEntry = mongoose.model("LedgerEntry", ledgerEntrySchema);

module.exports = LedgerEntry;
