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
    required: true,
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
ledgerEntrySchema.index({ scenarioId: 1, userId: 1 }, { unique: true });
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

  // Check if entry already exists for this scenario/user
  const existing = await this.findOne({
    scenarioId: input.scenarioId,
    userId: input.userId,
  });

  if (existing) {
    throw new Error(
      "Ledger entry already exists for this scenario and user. Delete existing entry before creating a new one."
    );
  }

  const entry = new this({
    classroomId: input.classroomId,
    scenarioId: input.scenarioId,
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
    aiMetadata: {
      model: input.aiMetadata.model,
      runId: input.aiMetadata.runId,
      generatedAt: input.aiMetadata.generatedAt || new Date(),
    },
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
  const query = { classroomId, userId };
  if (excludeScenarioId) {
    query.scenarioId = { $ne: excludeScenarioId };
  }
  return await this.find(query)
    .sort({ createdDate: 1 })
    .populate("scenarioId", "title")
    .lean();
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

const LedgerEntry = mongoose.model("LedgerEntry", ledgerEntrySchema);

module.exports = LedgerEntry;
