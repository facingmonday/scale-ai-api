const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");
// Note: Classroom, Enrollment, and Member are required inside functions to avoid circular dependencies
const { enqueueEmailSending } = require("../../lib/queues/email-worker");

const scenarioSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  isClosed: {
    type: Boolean,
    default: false,
  },
  week: {
    type: Number,
    default: 0,
  },
  imageUrl: {
    type: String,
    required: false,
  },
}).add(baseSchema);

// Apply variable population plugin
scenarioSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "scenario",
  outputFormat: "valueMap",
});

// Compound indexes for performance
scenarioSchema.index({ classroomId: 1, week: 1 });
scenarioSchema.index({ classroomId: 1, isPublished: 1, isClosed: 1 });
scenarioSchema.index({ classroomId: 1, createdDate: -1 });
scenarioSchema.index({ organization: 1, classroomId: 1 });

// Static methods - Shared utilities for scenario operations

/**
 * Get next week number for a class
 * @param {string} classroomId - Class ID
 * @returns {Promise<number>} Next week number
 */
scenarioSchema.statics.getNextWeekNumber = async function (classroomId) {
  let week = 0;
  const lastScenario = await this.findOne({ classroomId })
    .sort({ week: -1 })
    .limit(1)
    .lean();

  if (!lastScenario || !lastScenario.week) {
    week = 1;
  } else {
    week = parseInt(lastScenario.week) + 1;
  }

  return week;
};

/**
 * Validate scenario variables against VariableDefinition
 * @param {string} classroomId - Class ID
 * @param {Object} variables - Variables object to validate
 * @returns {Promise<Object>} Validation result
 */
scenarioSchema.statics.validateScenarioVariables = async function (
  classroomId,
  variables
) {
  return await VariableDefinition.validateValues(
    classroomId,
    "scenario",
    variables
  );
};

/**
 * Create a scenario
 * @param {string} classroomId - Class ID
 * @param {Object} scenarioData - Scenario data (title, description, variables)
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created scenario with variables populated
 */
scenarioSchema.statics.createScenario = async function (
  classroomId,
  scenarioData,
  organizationId,
  clerkUserId
) {
  // Get next week number
  const week = await this.getNextWeekNumber(classroomId);
  // Extract variables and imageUrl from scenarioData
  const { variables, imageUrl, ...scenarioFields } = scenarioData;

  // Validate variables if provided
  if (variables && Object.keys(variables).length > 0) {
    const validation = await this.validateScenarioVariables(
      classroomId,
      variables
    );

    if (!validation.isValid) {
      throw new Error(
        `Invalid scenario variables: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }

    // Apply defaults
    const variablesWithDefaults = await VariableDefinition.applyDefaults(
      classroomId,
      "scenario",
      variables
    );

    // Create scenario document
    const scenario = new this({
      classroomId,
      week,
      title: scenarioFields.title,
      description: scenarioFields.description || "",
      imageUrl: imageUrl || null,
      isPublished: false,
      isClosed: false,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await scenario.save();

    // Create variable values if provided
    const variableEntries = Object.entries(variablesWithDefaults);
    const variableDocs = variableEntries.map(([key, value]) => ({
      appliesTo: "scenario",
      ownerId: scenario._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await VariableValue.insertMany(variableDocs);
    }

    // Return scenario with variables populated (auto-loaded via plugin)
    const createdScenario = await this.findById(scenario._id);
    return createdScenario ? createdScenario.toObject() : null;
  }

  // No variables provided
  const scenario = new this({
    classroomId,
    week,
    title: scenarioFields.title,
    description: scenarioFields.description || "",
    imageUrl: imageUrl || null,
    isPublished: false,
    isClosed: false,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await scenario.save();
  // Variables are automatically included via plugin
  return scenario.toObject();
};

/**
 * Get active scenario (published and not closed)
 * @param {string} classroomId - Class ID
 * @returns {Promise<Object|null>} Active scenario with variables or null
 */
scenarioSchema.statics.getActiveScenario = async function (classroomId) {
  const scenario = await this.findOne({
    classroomId,
    isPublished: true,
    isClosed: false,
  }).sort({ week: -1 });

  if (!scenario) {
    return null;
  }

  await scenario._loadVariables();

  // Variables are automatically included via plugin's post-init hook
  return scenario.toObject();
};

/**
 * Get all scenarios for a class
 * @param {string} classroomId - Class ID
 * @param {Object} options - Options (includeClosed)
 * @returns {Promise<Array>} Array of scenarios with variables
 */
scenarioSchema.statics.getScenariosByClass = async function (
  classroomId,
  options = {}
) {
  const query = { classroomId };
  if (!options.includeClosed) {
    query.isClosed = false;
  }

  const scenarios = await this.find(query).sort({ week: 1 });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(scenarios);

  // Variables are automatically included via plugin
  return scenarios.map((scenario) => scenario.toObject());
};

/**
 * Get scenario by ID with class validation
 * @param {string} scenarioId - Scenario ID
 * @param {string} organizationId - Organization ID (optional, for validation)
 * @returns {Promise<Object|null>} Scenario with variables or null
 */
scenarioSchema.statics.getScenarioById = async function (
  scenarioId,
  organizationId = null
) {
  const query = { _id: scenarioId };
  if (organizationId) {
    query.organization = organizationId;
  }

  const scenario = await this.findOne(query);
  if (!scenario) {
    return null;
  }

  // Explicitly load variables to ensure they're cached (post-init hook is async and may not have completed)
  await scenario._loadVariables();

  // Variables are automatically included via plugin's toObject() override
  return scenario.toObject();
};

// Instance methods

/**
 * Get variables for this scenario instance
 * Uses cached variables if available, otherwise loads them
 * @returns {Promise<Object>} Variables object
 */
scenarioSchema.methods.getVariables = async function () {
  // Use plugin's cached variables or load them
  return await this._loadVariables();
};

/**
 * Update variables for this scenario
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} Updated variables object
 */
scenarioSchema.methods.updateVariables = async function (
  variables,
  organizationId,
  clerkUserId
) {
  // Validate variables
  const validation = await this.constructor.validateScenarioVariables(
    this.classroomId,
    variables
  );

  if (!validation.isValid) {
    throw new Error(
      `Invalid scenario variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    this.classroomId,
    "scenario",
    variables
  );

  // Update or create variable values
  const variableEntries = Object.entries(variablesWithDefaults);
  for (const [key, value] of variableEntries) {
    await VariableValue.setVariable(
      "scenario",
      this._id,
      key,
      value,
      organizationId,
      clerkUserId
    );
  }

  // Delete variables that are not in the new set
  const existingVariables = await VariableValue.find({
    appliesTo: "scenario",
    ownerId: this._id,
  });
  const newKeys = new Set(Object.keys(variablesWithDefaults));
  for (const existingVar of existingVariables) {
    if (!newKeys.has(existingVar.variableKey)) {
      await VariableValue.deleteOne({ _id: existingVar._id });
    }
  }

  // Reload variables to update cache
  await this._loadVariables();

  return variablesWithDefaults;
};

/**
 * Publish this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.publish = async function (clerkUserId) {
  // Check if there's already an active published scenario
  const activeScenario = await this.constructor.getActiveScenario(
    this.classroomId
  );
  if (activeScenario && activeScenario._id.toString() !== this._id.toString()) {
    throw new Error("Another scenario is already published and active");
  }

  this.isPublished = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Unpublish this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.unpublish = async function (clerkUserId) {
  this.isPublished = false;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Close this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.close = async function (clerkUserId) {
  this.isClosed = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Open (re-open) this scenario
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated scenario
 */
scenarioSchema.methods.open = async function (clerkUserId) {
  this.isClosed = false;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

/**
 * Check if scenario can be edited
 * @returns {boolean} True if can be edited
 */
scenarioSchema.methods.canEdit = function () {
  // Can edit if not published or not closed
  return !this.isPublished || !this.isClosed;
};

/**
 * Check if scenario can be published
 * @returns {Promise<boolean>} True if can be published
 */
scenarioSchema.methods.canPublish = async function () {
  // Can publish if not already published and not closed
  if (this.isPublished || this.isClosed) {
    return false;
  }

  // Check if another scenario is active
  const activeScenario = await this.constructor.getActiveScenario(
    this.classroomId
  );
  return (
    !activeScenario || activeScenario._id.toString() === this._id.toString()
  );
};

// Track creation state for post-save hooks
scenarioSchema.pre("save", function (next) {
  this._wasNew = this.isNew;
  next();
});

// Post-save hook to queue scenario creation emails for students
scenarioSchema.post("save", async function (doc, next) {
  try {
    if (!doc._wasNew) {
      return next();
    }

    await queueScenarioCreatedEmails(doc);
    return next();
  } catch (error) {
    console.error("Error queueing scenario created emails:", error);
    return next();
  }
});

async function queueScenarioCreatedEmails(scenario) {
  // Lazy load to avoid circular dependency
  const Classroom = require("../classroom/classroom.model");
  const Enrollment = require("../enrollment/enrollment.model");
  const Member = require("../members/member.model");

  const classroomId = scenario.classroomId;
  const organizationId = scenario.organization;

  if (!classroomId) {
    console.warn("No classroomId on scenario, skipping notification emails");
    return;
  }

  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    console.error("Classroom not found for scenario email notification");
    return;
  }

  // Get all enrolled students (members only)
  const enrollments = await Enrollment.findByClass(classroomId);
  const memberEnrollments = enrollments.filter((e) => e.role === "member");

  if (memberEnrollments.length === 0) {
    return;
  }

  const host =
    process.env.SCALE_COM_HOST ||
    process.env.SCALE_API_HOST ||
    "https://scale.ai";
  const scenarioLink = `${host}/class/${classroomId}/scenario/${scenario._id}`;

  await Promise.allSettled(
    memberEnrollments.map(async (enrollment) => {
      try {
        const member = await Member.findById(enrollment.userId);
        if (!member) {
          console.warn(`Member not found for enrollment ${enrollment._id}`);
          return;
        }

        const email = await member.getEmailFromClerk();
        if (!email) {
          console.warn(`No email found for member ${member._id}`);
          return;
        }

        await enqueueEmailSending({
          recipient: {
            email,
            name:
              `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
              email,
            memberId: member._id,
          },
          title: `New Scenario: ${scenario.title}`,
          message: `A new scenario "${scenario.title}" has been added to ${classroom.name}.`,
          templateSlug: "scenario-created",
          templateData: {
            scenario: {
              _id: scenario._id,
              title: scenario.title,
              description: scenario.description,
              link: scenarioLink,
            },
            classroom: {
              _id: classroom._id,
              name: classroom.name,
              description: classroom.description,
            },
            member: {
              _id: member._id,
              firstName: member.firstName,
              lastName: member.lastName,
              name: `${member.firstName || ""} ${member.lastName || ""}`.trim(),
              email,
              clerkUserId: member.clerkUserId,
            },
            organization: {
              _id: organizationId,
            },
            link: scenarioLink,
            env: {
              SCALE_COM_HOST: host,
              SCALE_API_HOST: process.env.SCALE_API_HOST || host,
            },
          },
          organizationId,
        });
      } catch (error) {
        console.error(
          `Error queueing email for enrollment ${enrollment._id}:`,
          error.message
        );
      }
    })
  );
}

/**
 * Get store type statistics aggregated from ledger entries
 * @param {Array} submissionsWithStores - Array of submissions with stores attached
 * @returns {Promise<Object>} Store type statistics object
 */
scenarioSchema.statics.getStoreTypeStats = async function (
  submissionsWithStores
) {
  // Aggregate statistics by store type from ledger entries
  const storeTypeStats = submissionsWithStores.reduce((acc, submission) => {
    const store = submission.store;
    const ledger = submission.ledgerEntryId;

    // Skip if no store or no ledger entry
    if (!store || !ledger) {
      return acc;
    }

    const storeType = store.storeType;
    if (!acc[storeType]) {
      acc[storeType] = {
        storeType: storeType,
        count: 0,
        totals: {
          sales: 0,
          revenue: 0,
          costs: 0,
          waste: 0,
          netProfit: 0,
          cashAfter: 0,
          inventoryState: {
            refrigeratedUnits: 0,
            ambientUnits: 0,
            notForResaleUnits: 0,
          },
        },
        averages: {
          sales: 0,
          revenue: 0,
          costs: 0,
          waste: 0,
          netProfit: 0,
          cashAfter: 0,
          inventoryState: {
            refrigeratedUnits: 0,
            ambientUnits: 0,
            notForResaleUnits: 0,
          },
        },
        winners: [], // Top performers by netProfit
        losers: [], // Bottom performers by netProfit
        submissions: [], // Store submission data for detailed analysis
      };
    }

    const stats = acc[storeType];
    stats.count += 1;

    // Accumulate totals
    stats.totals.sales += ledger.sales || 0;
    stats.totals.revenue += ledger.revenue || 0;
    stats.totals.costs += ledger.costs || 0;
    stats.totals.waste += ledger.waste || 0;
    stats.totals.netProfit += ledger.netProfit || 0;
    stats.totals.cashAfter += ledger.cashAfter || 0;
    const ledgerInventoryState = ledger.inventoryState || {
      refrigeratedUnits: 0,
      ambientUnits: 0,
      notForResaleUnits: 0,
    };
    stats.totals.inventoryState.refrigeratedUnits +=
      ledgerInventoryState.refrigeratedUnits || 0;
    stats.totals.inventoryState.ambientUnits +=
      ledgerInventoryState.ambientUnits || 0;
    stats.totals.inventoryState.notForResaleUnits +=
      ledgerInventoryState.notForResaleUnits || 0;

    // Store submission data for winner/loser analysis
    stats.submissions.push({
      userId: submission.userId,
      store: {
        _id: store._id,
        shopName: store.shopName,
        storeType: store.storeType,
      },
      ledger: {
        sales: ledger.sales || 0,
        revenue: ledger.revenue || 0,
        costs: ledger.costs || 0,
        waste: ledger.waste || 0,
        netProfit: ledger.netProfit || 0,
        cashAfter: ledger.cashAfter || 0,
        inventoryState: ledger.inventoryState || {
          refrigeratedUnits: 0,
          ambientUnits: 0,
          notForResaleUnits: 0,
        },
      },
    });

    return acc;
  }, {});

  // Calculate averages and identify winners/losers for each store type
  Object.keys(storeTypeStats).forEach((storeType) => {
    const stats = storeTypeStats[storeType];
    const count = stats.count;

    // Calculate averages
    stats.averages.sales = count > 0 ? stats.totals.sales / count : 0;
    stats.averages.revenue = count > 0 ? stats.totals.revenue / count : 0;
    stats.averages.costs = count > 0 ? stats.totals.costs / count : 0;
    stats.averages.waste = count > 0 ? stats.totals.waste / count : 0;
    stats.averages.netProfit = count > 0 ? stats.totals.netProfit / count : 0;
    stats.averages.cashAfter = count > 0 ? stats.totals.cashAfter / count : 0;
    stats.averages.inventoryState.refrigeratedUnits =
      count > 0 ? stats.totals.inventoryState.refrigeratedUnits / count : 0;
    stats.averages.inventoryState.ambientUnits =
      count > 0 ? stats.totals.inventoryState.ambientUnits / count : 0;
    stats.averages.inventoryState.notForResaleUnits =
      count > 0 ? stats.totals.inventoryState.notForResaleUnits / count : 0;

    // Sort submissions by netProfit to find winners and losers
    const sortedSubmissions = [...stats.submissions].sort(
      (a, b) => b.ledger.netProfit - a.ledger.netProfit
    );

    // Top 3 winners (highest netProfit)
    stats.winners = sortedSubmissions.slice(0, 3).map((sub) => ({
      userId: sub.userId,
      store: sub.store,
      netProfit: sub.ledger.netProfit,
      revenue: sub.ledger.revenue,
      sales: sub.ledger.sales,
    }));

    // Bottom 3 losers (lowest netProfit)
    stats.losers = sortedSubmissions
      .slice(-3)
      .reverse()
      .map((sub) => ({
        userId: sub.userId,
        store: sub.store,
        netProfit: sub.ledger.netProfit,
        revenue: sub.ledger.revenue,
        sales: sub.ledger.sales,
      }));

    // Remove detailed submissions array to keep response lean
    delete stats.submissions;
  });

  return storeTypeStats;
};

/**
 * Get total enrolled students count for a classroom
 * @param {string} classroomId - Classroom ID
 * @returns {Promise<number>} Total enrolled students count
 */
scenarioSchema.statics.getTotalEnrolled = async function (classroomId) {
  const Enrollment = require("../enrollment/enrollment.model");
  return await Enrollment.countByClass(classroomId);
};

/**
 * Get submitted count for a scenario
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<number>} Submitted count
 */
scenarioSchema.statics.getSubmittedCount = async function (scenarioId) {
  const Submission = require("../submission/submission.model");
  return await Submission.countDocuments({ scenarioId });
};

/**
 * Get missing submissions count for a scenario
 * @param {string} classroomId - Classroom ID
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<number>} Missing submissions count
 */
scenarioSchema.statics.getMissingCount = async function (
  classroomId,
  scenarioId
) {
  const Submission = require("../submission/submission.model");
  const missingUserIds = await Submission.getMissingSubmissions(
    classroomId,
    scenarioId
  );
  return missingUserIds.length;
};

/**
 * Get missing submissions with user details for a scenario
 * @param {string} classroomId - Classroom ID
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Array>} Array of missing users with details
 */
scenarioSchema.statics.getMissingSubmissions = async function (
  classroomId,
  scenarioId
) {
  const Submission = require("../submission/submission.model");
  const Member = require("../members/member.model");

  const missingUserIds = await Submission.getMissingSubmissions(
    classroomId,
    scenarioId
  );

  // Get user details for missing submissions
  const missingUsers = await Member.find({
    _id: { $in: missingUserIds },
  }).select("_id firstName lastName maskedEmail clerkUserId");

  return missingUsers.map((u) => ({
    ...u.toObject(),
    email: u.maskedEmail,
  }));
};

/**
 * Get stats for a scenario
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Object>} Stats object
 */
scenarioSchema.statics.getStatsForScenario = async function (scenarioId) {
  // Lazy load to avoid circular dependencies
  const Submission = require("../submission/submission.model");
  const Store = require("../store/store.model");

  const scenario = await this.findById(scenarioId);
  if (!scenario) {
    return null;
  }

  const submissions = await Submission.find({ scenarioId: scenarioId })
    .populate({
      path: "userId",
      select: "_id clerkUserId firstName lastName maskedEmail",
    })
    .populate({
      path: "jobs",
      select: "_id status error attempts startedAt completedAt dryRun",
    })
    .populate({
      path: "ledgerEntryId",
      select:
        "_id sales revenue costs waste cashBefore cashAfter inventoryState netProfit",
    })
    .lean();

  // Fetch all stores for this classroom (with variables populated)
  const stores = await Store.getStoresByClass(scenario.classroomId);

  // Create a map of userId -> store for quick lookup
  const storeMap = new Map();
  stores.forEach((store) => {
    storeMap.set(store.userId.toString(), store);
  });

  // Attach stores to submissions
  const submissionsWithStores = submissions.map((submission) => {
    const store = storeMap.get(submission.userId._id.toString());
    return {
      ...submission,
      store: store || null,
    };
  });

  // Get all stats in parallel
  const [
    storeTypeStats,
    totalEnrolled,
    submittedCount,
    missingCount,
    missingSubmissions,
  ] = await Promise.all([
    this.getStoreTypeStats(submissionsWithStores),
    this.getTotalEnrolled(scenario.classroomId),
    this.getSubmittedCount(scenarioId),
    this.getMissingCount(scenario.classroomId, scenarioId),
    this.getMissingSubmissions(scenario.classroomId, scenarioId),
  ]);

  return {
    submissions: submissionsWithStores,
    storeTypeStats: storeTypeStats,
    totalEnrolled: totalEnrolled,
    submittedCount: submittedCount,
    missingCount: missingCount,
    missingSubmissions: missingSubmissions,
  };
};

/**
 * Process scenario export - generates CSV with all submissions and uploads to S3
 * @param {string} scenarioId - Scenario ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Export result with s3Url and total
 */
scenarioSchema.statics.processScenarioExport = async function (
  scenarioId,
  organizationId
) {
  const Submission = require("../submission/submission.model");
  const LedgerEntry = require("../ledger/ledger.model");
  const AWS = require("aws-sdk");
  const { Parser } = require("json2csv");

  // Get scenario
  const scenario = await this.findById(scenarioId);
  if (!scenario) {
    throw new Error("Scenario not found");
  }

  // Get all submissions with populated user (don't use lean yet so we can populate variables)
  const submissionDocs = await Submission.find({ scenarioId }).populate({
    path: "userId",
    select: "_id clerkUserId firstName lastName maskedEmail",
  });

  // Batch populate variables for all submissions
  await Submission.populateVariablesForMany(submissionDocs);

  // Get all ledger entries for this scenario
  const ledgerEntries = await LedgerEntry.find({ scenarioId }).lean();

  // Create a map of userId -> ledger entry for quick lookup
  const ledgerMap = new Map();
  ledgerEntries.forEach((ledger) => {
    ledgerMap.set(ledger.userId.toString(), ledger);
  });

  // Flatten data for CSV
  const csvData = submissionDocs.map((submission) => {
    const submissionObj = submission.toObject();
    const userId =
      submissionObj.userId?._id?.toString() || submissionObj.userId?.toString();
    const ledger = userId ? ledgerMap.get(userId) : null;
    const variables = submissionObj.variables || {};

    // Build base row with submission and user data
    const row = {
      // Submission metadata
      submissionId: submissionObj._id.toString(),
      submissionSubmittedAt: submissionObj.submittedAt
        ? new Date(submissionObj.submittedAt).toISOString()
        : "",
      submissionProcessingStatus: submissionObj.processingStatus || "pending",

      // User/Student data
      userId: userId || "",
      studentFirstName: submissionObj.userId?.firstName || "",
      studentLastName: submissionObj.userId?.lastName || "",
      studentEmail: submissionObj.userId?.maskedEmail || "",
      studentClerkUserId: submissionObj.userId?.clerkUserId || "",

      // Submission variables (flattened)
      ...Object.keys(variables).reduce((acc, key) => {
        const value = variables[key];
        // Handle complex values by stringifying
        acc[`submission_${key}`] =
          typeof value === "object" ? JSON.stringify(value) : value;
        return acc;
      }, {}),
    };

    // Add ledger data if it exists
    if (ledger) {
      row.ledgerId = ledger._id.toString();
      row.ledgerSales = ledger.sales || 0;
      row.ledgerRevenue = ledger.revenue || 0;
      row.ledgerCosts = ledger.costs || 0;
      row.ledgerWaste = ledger.waste || 0;
      row.ledgerCashBefore = ledger.cashBefore || 0;
      row.ledgerCashAfter = ledger.cashAfter || 0;
      row.ledgerInventoryBefore = ledger.inventoryBefore || 0;
      row.ledgerInventoryAfter = ledger.inventoryAfter || 0;
      row.ledgerNetProfit = ledger.netProfit || 0;
      row.ledgerRandomEvent = ledger.randomEvent || "";
      row.ledgerSummary = ledger.summary || "";
      row.ledgerOverridden = ledger.overridden || false;
      row.ledgerCreatedDate = ledger.createdDate
        ? new Date(ledger.createdDate).toISOString()
        : "";
    } else {
      // Add empty ledger columns
      row.ledgerId = "";
      row.ledgerSales = "";
      row.ledgerRevenue = "";
      row.ledgerCosts = "";
      row.ledgerWaste = "";
      row.ledgerCashBefore = "";
      row.ledgerCashAfter = "";
      row.ledgerInventoryBefore = "";
      row.ledgerInventoryAfter = "";
      row.ledgerNetProfit = "";
      row.ledgerRandomEvent = "";
      row.ledgerSummary = "";
      row.ledgerOverridden = "";
      row.ledgerCreatedDate = "";
    }

    return row;
  });

  // Generate CSV
  // If no submissions, return empty result
  if (csvData.length === 0) {
    throw new Error("No submissions found for this scenario");
  }

  // Let json2csv auto-detect all fields from all rows (handles dynamic variable columns)
  const parser = new Parser();
  const csv = parser.parse(csvData);

  // Upload to S3/Spaces
  const spacesEndpoint = new AWS.Endpoint(
    "https://nyc3.digitaloceanspaces.com"
  );
  const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_API_KEY,
    secretAccessKey: process.env.SPACES_API_SECRET,
  });

  const timestamp = Date.now();
  const fileName = `scenario_${scenarioId}_export_${timestamp}.csv`;
  const keyPath = `organizations/${organizationId}/exports/${fileName}`;

  const uploadParams = {
    Bucket: process.env.SPACES_BUCKET,
    Key: keyPath,
    Body: csv,
    ACL: "public-read",
    ContentType: "text/csv",
  };

  const uploadResult = await s3.upload(uploadParams).promise();
  let fileUrl = uploadResult.Location;

  // Ensure URL has https
  if (!fileUrl.startsWith("http")) {
    fileUrl = "https://" + fileUrl;
  }

  return {
    s3Url: fileUrl,
    total: csvData.length,
  };
};

const Scenario = mongoose.model("Scenario", scenarioSchema);

module.exports = Scenario;
