const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");
// Note: Classroom, Enrollment, and Member are required inside functions to avoid circular dependencies

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
      classroomId,
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
      this.classroomId,
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
    classroomId: this.classroomId,
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
  // Track if isPublished is being changed from false to true
  if (!this.isNew && this.isModified("isPublished") && this.isPublished) {
    this._isPublishedJustSet = true;
  } else if (this.isNew && this.isPublished) {
    this._isPublishedJustSet = true;
  } else {
    this._isPublishedJustSet = false;
  }
  // Track if isClosed is being modified (to skip published email check when closing)
  this._isClosedJustSet =
    !this.isNew && this.isModified("isClosed") && this.isClosed;
  next();
});

// Post-save hook to send emails when scenario is published
// Note: This checks for the "scenario-created" (published) email, NOT the "scenario-closed" (results) email
// Results emails are sent from the ledger model when ledger entries are created
scenarioSchema.post("save", async function (doc, next) {
  try {
    // Skip published email check if scenario is being closed (results email will be sent when ledger entries are created)
    if (doc._isClosedJustSet) {
      return next();
    }

    // Only check for published email if scenario is published
    if (doc.isPublished) {
      // Double-check: fetch the document to see if notifications were already sent
      // This prevents duplicate notifications on document updates
      const Notification = require("../notifications/notifications.model");
      const existingNotification = await Notification.findOne({
        "modelData.scenario": doc._id,
        templateSlug: "scenario-created",
        type: "email",
      }).lean();

      // Send email if:
      // 1. isPublished was just set to true (new publish), OR
      // 2. Scenario is published but no notification exists (handles cases where email wasn't sent initially)
      const shouldSendEmail =
        doc._isPublishedJustSet || (!existingNotification && doc.isPublished);

      if (shouldSendEmail) {
        await queueScenarioPublishedEmails(doc);
      }
    }
    return next();
  } catch (error) {
    console.error("Error queueing scenario published emails:", error);
    return next();
  }
});

async function queueScenarioPublishedEmails(scenario) {
  const Classroom = require("../classroom/classroom.model");
  const Enrollment = require("../enrollment/enrollment.model");
  const Notification = require("../notifications/notifications.model");

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

  const host = process.env.SCALE_ADMIN_HOST || "https://localhost:5173";
  const scenarioLink = `${host}/class/${classroomId}/scenario/${scenario._id}`;

  // Get the clerkUserId from the scenario (updatedBy is set when published)
  // The scenario should be a Mongoose document with updatedBy set from the publish() call
  let clerkUserId = scenario.updatedBy || scenario.createdBy;

  // If scenario is a plain object (from toObject()), try to get updatedBy from it
  // Otherwise, if we have an ID, fetch the document
  if (!clerkUserId && scenario._id) {
    const ScenarioModel = require("./scenario.model");
    const scenarioDoc = await ScenarioModel.findById(scenario._id).select(
      "updatedBy createdBy"
    );
    if (scenarioDoc) {
      clerkUserId = scenarioDoc.updatedBy || scenarioDoc.createdBy;
    }
  }

  // Fallback to a system user if we still don't have a clerkUserId
  if (!clerkUserId) {
    clerkUserId = "system";
    console.warn(
      "No clerkUserId found on scenario, using 'system' for notification createdBy/updatedBy"
    );
  }

  // Create notifications for all enrolled students
  const notifications = await Promise.allSettled(
    memberEnrollments.map(async (enrollment) => {
      try {
        const notification = await Notification.create({
          type: "email",
          recipient: {
            id: enrollment.userId,
            type: "Member",
            ref: "Member",
          },
          title: `New Scenario Published: ${scenario.title}`,
          message: `A new scenario "${scenario.title}" has been published for ${classroom.name}. Review the details and submit your plan.`,
          templateSlug: "scenario-created",
          templateData: {
            link: scenarioLink,
            env: {
              SCALE_ADMIN_HOST: host,
              SCALE_API_HOST: process.env.SCALE_API_HOST || host,
            },
          },
          modelData: {
            scenario: scenario._id,
            classroom: classroomId,
            member: enrollment.userId,
            organization: organizationId,
          },
          organization: organizationId,
          createdBy: clerkUserId,
          updatedBy: clerkUserId,
        });
        return notification;
      } catch (error) {
        console.error(
          `Error creating notification for enrollment ${enrollment._id}:`,
          error.message
        );
        throw error;
      }
    })
  );

  const successful = notifications.filter(
    (n) => n.status === "fulfilled"
  ).length;
  const failed = notifications.filter((n) => n.status === "rejected").length;

  if (successful > 0) {
    console.log(
      `Created ${successful} notification(s) for scenario publication: ${scenario._id}`
    );
  }

  if (failed > 0) {
    console.error(
      `Failed to create ${failed} notification(s) for scenario: ${scenario._id}`
    );
  }
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

    const storeType = store.storeType?.label;
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
        studentId: store.studentId,
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
    console.log("storeType", JSON.stringify(storeType));
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
 * Delete a scenario and all related data (cascade delete)
 * Deletes: scenarioOutcome, submissions, ledger entries, jobs, variable values, and notifications
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Object|null>} Deleted scenario or null if not found
 */
scenarioSchema.statics.deleteScenario = async function (scenarioId) {
  // Lazy load models to avoid circular dependencies
  const ScenarioOutcome = require("../scenarioOutcome/scenarioOutcome.model");
  const Submission = require("../submission/submission.model");
  const LedgerEntry = require("../ledger/ledger.model");
  const SimulationJob = require("../job/job.model");
  const VariableValue = require("../variableDefinition/variableValue.model");
  const Notification = require("../notifications/notifications.model");

  // Find the scenario first
  const scenario = await this.findById(scenarioId);
  if (!scenario) {
    return null;
  }

  // Delete in order to avoid foreign key issues:
  // 1. Delete scenario outcome
  await ScenarioOutcome.deleteOne({ scenarioId });

  // 2. Delete ledger entries (these reference scenarioId)
  await LedgerEntry.deleteMany({ scenarioId });

  // 3. Delete simulation jobs (these reference scenarioId)
  await SimulationJob.deleteMany({ scenarioId });

  // 4. Get all submission IDs before deleting (needed for variable value cleanup)
  const submissions = await Submission.find({ scenarioId })
    .select("_id")
    .lean();
  const submissionIds = submissions.map((s) => s._id);

  // 5. Delete submissions (these reference scenarioId)
  await Submission.deleteMany({ scenarioId });

  // 6. Delete variable values for submissions (appliesTo: "submission", ownerId in submissionIds)
  if (submissionIds.length > 0) {
    await VariableValue.deleteMany({
      appliesTo: "submission",
      ownerId: { $in: submissionIds },
    });
  }

  // 7. Delete variable values for this scenario (appliesTo: "scenario", ownerId: scenarioId)
  await VariableValue.deleteMany({
    appliesTo: "scenario",
    ownerId: scenarioId,
  });

  // 8. Delete notifications that reference this scenario in modelData
  await Notification.deleteMany({
    "modelData.scenario": scenarioId,
  });

  // 9. Finally, delete the scenario itself
  await this.findByIdAndDelete(scenarioId);

  return scenario;
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
  const Store = require("../store/store.model");
  const AWS = require("aws-sdk");
  const { Parser } = require("json2csv");

  // Flatten nested objects into a single-level map for CSV columns.
  // Example: { a: { b: 1 } } => { prefix_a_b: 1 }
  const toSafeKeyPart = (k) =>
    String(k)
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const flattenForCsv = (value, prefix) => {
    const out = {};

    const walk = (v, path) => {
      if (v === undefined) return;
      if (v === null) {
        out[path] = "";
        return;
      }
      if (v instanceof Date) {
        out[path] = v.toISOString();
        return;
      }
      if (Array.isArray(v)) {
        if (v.length === 0) {
          out[path] = "";
          return;
        }
        v.forEach((item, idx) => {
          walk(item, `${path}_${idx}`);
        });
        return;
      }
      if (typeof v === "object") {
        const keys = Object.keys(v);
        if (keys.length === 0) {
          out[path] = "";
          return;
        }
        keys.forEach((key) => {
          const safe = toSafeKeyPart(key) || "key";
          walk(v[key], `${path}_${safe}`);
        });
        return;
      }

      // Primitive
      out[path] = v;
    };

    const safePrefix = toSafeKeyPart(prefix) || "value";
    walk(value, safePrefix);
    return out;
  };

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

  // Load stores so we can export shopName + studentId
  const classroomId = scenario.classroomId;
  const userIdsForStores = submissionDocs
    .map((s) => s?.userId?._id || s?.userId)
    .filter(Boolean);
  const stores = userIdsForStores.length
    ? await Store.find({ classroomId, userId: { $in: userIdsForStores } })
        .select("userId studentId shopName")
        .lean()
    : [];
  const storeByUserId = new Map(
    (stores || []).map((st) => [st.userId.toString(), st])
  );

  // Flatten data for CSV
  const csvData = submissionDocs.map((submission) => {
    const submissionObj = submission.toObject();
    const userId =
      submissionObj.userId?._id?.toString() || submissionObj.userId?.toString();
    const ledger = userId ? ledgerMap.get(userId) : null;
    const store = userId ? storeByUserId.get(userId) : null;
    const variables = submissionObj.variables || {};

    const flattenedInventoryState = ledger
      ? flattenForCsv(ledger.inventoryState || null, "ledgerInventoryState")
      : {
          ledgerInventoryState_refrigeratedUnits: "",
          ledgerInventoryState_ambientUnits: "",
          ledgerInventoryState_notForResaleUnits: "",
        };

    const flattenedEducation = ledger
      ? flattenForCsv(ledger.education ?? null, "ledgerEducation")
      : { ledgerEducation: "" };

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

      // Store data
      storeShopName: store?.shopName || "",
      storeStudentId: store?.studentId || "",

      // Ledger nested fields (flattened)
      ...flattenedInventoryState,
      ...flattenedEducation,

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
