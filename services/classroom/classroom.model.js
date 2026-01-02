const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const Enrollment = require("../enrollment/enrollment.model");
const Scenario = require("../scenario/scenario.model");
const Submission = require("../submission/submission.model");
const LedgerEntry = require("../ledger/ledger.model");
const ScenarioOutcome = require("../scenarioOutcome/scenarioOutcome.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");

const classroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  // Starting cash used to seed the initial ledger entry (week 0) for newly created stores
  startingBalance: {
    type: Number,
    default: 0,
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
 * Includes classroom-scoped definitions (store, scenario, submission, storeType)
 * @param {string} classroomId - Class ID
 * @param {Object} options - Options (includeInactive)
 * @returns {Promise<Object>} Object with variableDefinitions grouped by type: { store: [], scenario: [], submission: [], storeType: [] }
 */
classroomSchema.statics.getAllVariableDefinitionsForClassroom = async function (
  classroomId,
  options = {}
) {
  // Fetch all classroom-scoped variableDefinitions (store, scenario, submission)
  const classroomVariableDefinitions =
    await VariableDefinition.getDefinitionsByClass(classroomId, options);

  // Fetch classroom-scoped storeType variableDefinitions
  const storeTypeDefinitions = await VariableDefinition.getDefinitionsForScope(
    classroomId,
    "storeType",
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

  // Add classroom-scoped storeType definitions
  variableDefinitionsByType.storeType = storeTypeDefinitions;

  return variableDefinitionsByType;
};

/**
 * Get the canonical submission variable definitions
 * @returns {Array} Array of submission variable definition objects
 */
classroomSchema.statics.getDefaultSubmissionVariableDefinitions = function () {
  // Backward-compat wrapper: canonical defaults live on ClassroomTemplate
  return ClassroomTemplate.getDefaultSubmissionVariableDefinitions();
};

/**
 * Canonical classroom-scoped storeType variable definitions.
 * @returns {Array} Array of storeType variable definition objects
 */
classroomSchema.statics.getDefaultStoreTypeVariableDefinitions = function () {
  // Backward-compat wrapper: canonical defaults live on ClassroomTemplate
  return ClassroomTemplate.getDefaultStoreTypeVariableDefinitions();
};

/**
 * Seed classroom-scoped storeType VariableDefinitions + StoreTypes + VariableValues.
 *
 * - Definitions are classroom-scoped and apply only within this class.
 * - StoreTypes are classroom-scoped and sourced from STORE_TYPE_PRESETS (key/label/description only).
 * - VariableValues are created for each StoreType × Definition using definition.defaultValue.
 *   Idempotent: does NOT overwrite existing VariableValues.
 *
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Stats
 */
classroomSchema.statics.seedStoreTypesAndVariables = async function (
  classroomId,
  organizationId,
  clerkUserId
) {
  // Deprecated: seeding is now handled by ClassroomTemplate application.
  const defaultKey = ClassroomTemplate.GLOBAL_DEFAULT_KEY;
  let template = await ClassroomTemplate.findOne({
    organization: organizationId,
    key: defaultKey,
    isActive: true,
  });
  if (!template) {
    await ClassroomTemplate.copyGlobalToOrganization(
      organizationId,
      clerkUserId
    );
    template = await ClassroomTemplate.findOne({
      organization: organizationId,
      key: defaultKey,
      isActive: true,
    });
  }

  if (!template) {
    return {
      storeTypesCreated: 0,
      storeTypesSkipped: 0,
      variableDefinitionsCreated: 0,
      variableDefinitionsSkipped: 0,
      variableValuesCreated: 0,
      variableValuesSkipped: 0,
    };
  }

  return await template.applyToClassroom({
    classroomId,
    organizationId,
    clerkUserId,
  });
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
  const variableDefinitions =
    ClassroomTemplate.getDefaultSubmissionVariableDefinitions();
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
