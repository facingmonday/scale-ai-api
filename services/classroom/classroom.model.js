const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const Enrollment = require("../enrollment/enrollment.model");
const Scenario = require("../scenario/scenario.model");
const Submission = require("../submission/submission.model");
const LedgerEntry = require("../ledger/ledger.model");
const ScenarioOutcome = require("../scenarioOutcome/scenarioOutcome.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");

const classroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  adminIds: {
    type: [String], // Clerk user IDs
    default: [],
  },
  ownership: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    index: true,
  },
  imageUrl: {
    type: String,
    required: false,
  },
}).add(baseSchema);

// Indexes for performance
classroomSchema.index({ organization: 1, name: 1 });
classroomSchema.index({ organization: 1, isActive: 1 });
classroomSchema.index({ organization: 1, createdDate: -1 });
classroomSchema.index({ adminIds: 1 });

// Virtual for enrollment count
classroomSchema.virtual("enrollmentCount", {
  ref: "Enrollment",
  localField: "_id",
  foreignField: "classroomId",
  count: true,
});

// Static methods
classroomSchema.statics.findByOrganization = function (orgId) {
  return this.find({ organization: orgId });
};

classroomSchema.statics.findActiveByOrganization = function (orgId) {
  return this.find({ organization: orgId, isActive: true });
};

// Instance methods
classroomSchema.methods.isAdmin = function (clerkUserId) {
  return this.adminIds.includes(clerkUserId);
};

classroomSchema.methods.addAdmin = function (clerkUserId) {
  if (!this.adminIds.includes(clerkUserId)) {
    this.adminIds.push(clerkUserId);
  }
  return this;
};

classroomSchema.methods.removeAdmin = function (clerkUserId) {
  this.adminIds = this.adminIds.filter((id) => id !== clerkUserId);
  return this;
};

/**
 * Get dashboard data for a class
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID for scoping
 * @returns {Promise<Object>} Dashboard data
 */
classroomSchema.statics.getDashboard = async function (
  classroomId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });

  if (!classDoc) {
    throw new Error("Class not found");
  }

  // Count students (members with role 'member')
  const studentCount = await Enrollment.countByClass(classroomId);

  // Get active scenario
  const activeScenario = await Scenario.getActiveScenario(classroomId);
  const activeScenarioData = activeScenario
    ? {
        id: activeScenario._id,
        title: activeScenario.title,
        description: activeScenario.description,
        variables: activeScenario.variables,
        isPublished: activeScenario.isPublished,
        isClosed: activeScenario.isClosed,
      }
    : null;

  // Count completed submissions for active scenario
  let submissionsCompleted = 0;
  if (activeScenario) {
    const submissions = await Submission.getSubmissionsByScenario(
      activeScenario._id
    );
    submissionsCompleted = submissions.length;
  }

  // Get leaderboard top 3 (by total netProfit across all scenarios in class)
  const leaderboardTop3 = await LedgerEntry.aggregate([
    { $match: { classroomId: new mongoose.Types.ObjectId(classroomId) } },
    {
      $group: {
        _id: "$userId",
        totalProfit: { $sum: "$netProfit" },
      },
    },
    { $sort: { totalProfit: -1 } },
    { $limit: 3 },
    {
      $lookup: {
        from: "members",
        localField: "_id",
        foreignField: "_id",
        as: "member",
      },
    },
    { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        userId: "$_id",
        totalProfit: 1,
        firstName: "$member.firstName",
        lastName: "$member.lastName",
      },
    },
  ]);

  // Get pending approvals (published scenarios with outcomes that are not approved)
  const publishedScenarios = await Scenario.find({
    classroomId,
    isPublished: true,
    isClosed: false,
  }).select("_id");

  let pendingApprovals = 0;
  if (publishedScenarios.length > 0) {
    const scenarioIds = publishedScenarios.map((s) => s._id);
    const pendingOutcomes = await ScenarioOutcome.countDocuments({
      scenarioId: { $in: scenarioIds },
      approved: false,
    });
    pendingApprovals = pendingOutcomes;
  }

  return {
    className: classDoc.name,
    classDescription: classDoc.description,
    isActive: classDoc.isActive,
    students: studentCount,
    activeScenario: activeScenarioData,
    submissionsCompleted: submissionsCompleted,
    leaderboardTop3: leaderboardTop3,
    pendingApprovals: pendingApprovals,
  };
};

classroomSchema.statics.getStudentDashboard = async function (
  classroomId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });
  if (!classDoc) {
    throw new Error("Class not found");
  }

  const activeScenario = await Scenario.getActiveScenario(classroomId);
  const activeScenarioData = activeScenario
    ? {
        id: activeScenario._id,
        title: activeScenario.title,
        description: activeScenario.description,
        variables: activeScenario.variables,
        isPublished: activeScenario.isPublished,
        isClosed: activeScenario.isClosed,
      }
    : null;

  // Get the subission for the student for the active scenario
  const submission = await Submission.getSubmission(
    classroomId,
    activeScenario._id,
    member._id
  );

  const submissionData = submission
    ? {
        ...submission,
        id: submission._id,
        variables: submission.variables,
      }
    : null;

  return {
    className: classDoc.name,
    classDescription: classDoc.description,
    isActive: classDoc.isActive,
    activeScenario: activeScenarioData,
    submission: submissionData,
  };
};

/**
 * Get roster for a class
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID for scoping
 * @returns {Promise<Array>} Roster data with student info
 * @deprecated Use Enrollment.getClassRoster() instead
 */
classroomSchema.statics.getRoster = async function (
  classroomId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });

  if (!classDoc) {
    throw new Error("Class not found");
  }

  // Delegate to Enrollment model
  return await Enrollment.getClassRoster(classroomId);
};

/**
 * Validate admin access to a class
 * @param {string} classroomId - Class ID
 * @param {string} clerkUserId - Clerk user ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Class document if admin, throws error otherwise
 */
classroomSchema.statics.validateAdminAccess = async function (
  classroomId,
  clerkUserId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classroomId,
    organization: organizationId,
  });

  if (!classDoc) {
    throw new Error("Class not found");
  }

  if (!classDoc.isAdmin(clerkUserId)) {
    throw new Error("Insufficient permissions: Admin access required");
  }

  return classDoc;
};

/**
 * Generate join link for a class
 * @param {string} classroomId - Class ID
 * @returns {string} Join link URL
 */
classroomSchema.statics.generateJoinLink = function (classroomId) {
  const baseUrl = process.env.SCALE_APP_HOST || "http://localhost:5173";
  return `${baseUrl}/class/${classroomId}/join`;
};

/**
 * Get all variable definitions for a classroom, grouped by appliesTo type
 * Includes both classroom-scoped definitions (store, scenario, submission) and
 * organization-scoped storeType definitions
 * @param {string} classroomId - Class ID
 * @param {Object} options - Options (includeInactive)
 * @returns {Promise<Object>} Object with variableDefinitions grouped by type: { store: [], scenario: [], submission: [], storeType: [] }
 */
classroomSchema.statics.getAllVariableDefinitionsForClassroom = async function (
  classroomId,
  options = {}
) {
  // Get classroom to retrieve organization ID
  const classroom = await this.findById(classroomId);
  if (!classroom) {
    throw new Error("Classroom not found");
  }

  const organizationId = classroom.organization;

  // Fetch all classroom-scoped variableDefinitions (store, scenario, submission)
  const classroomVariableDefinitions =
    await VariableDefinition.getDefinitionsByClass(classroomId, options);

  // Fetch organization-scoped storeType variableDefinitions
  const storeTypeDefinitions = await VariableDefinition.getStoreTypeDefinitions(
    organizationId,
    options
  );

  // Group variableDefinitions by appliesTo type
  const variableDefinitionsByType = {
    store: [],
    scenario: [],
    submission: [],
    storeType: [],
  };

  // Add classroom-scoped definitions
  classroomVariableDefinitions.forEach((def) => {
    if (variableDefinitionsByType[def.appliesTo]) {
      variableDefinitionsByType[def.appliesTo].push(def);
    }
  });

  // Add organization-scoped storeType definitions
  variableDefinitionsByType.storeType = storeTypeDefinitions;

  return variableDefinitionsByType;
};

/**
 * Get the canonical submission variable definitions
 * @returns {Array} Array of submission variable definition objects
 */
classroomSchema.statics.getDefaultSubmissionVariableDefinitions = function () {
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
 * Seed submission variable definitions for a classroom
 * Idempotent: skips variables that already exist
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Stats object with created and skipped counts
 */
classroomSchema.statics.seedSubmissionVariables = async function (
  classroomId,
  organizationId,
  clerkUserId
) {
  const variableDefinitions = this.getDefaultSubmissionVariableDefinitions();
  const stats = {
    created: 0,
    skipped: 0,
    errors: 0,
  };

  for (const def of variableDefinitions) {
    try {
      // Check if variable already exists
      const exists = await VariableDefinition.findOne({
        classroomId,
        key: def.key,
      }).select("_id");

      if (exists) {
        stats.skipped += 1;
        continue;
      }

      // Create the variable definition
      await VariableDefinition.createDefinition(
        classroomId,
        def,
        organizationId,
        clerkUserId
      );
      stats.created += 1;
    } catch (error) {
      console.error(
        `Error creating submission variable ${def.key} for classroom ${classroomId}:`,
        error.message
      );
      stats.errors += 1;
    }
  }

  return stats;
};

const Classroom = mongoose.model("Classroom", classroomSchema);

module.exports = Classroom;
