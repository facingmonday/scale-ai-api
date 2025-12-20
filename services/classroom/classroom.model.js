const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const Enrollment = require("../enrollment/enrollment.model");
const Scenario = require("../scenario/scenario.model");
const Submission = require("../submission/submission.model");
const LedgerEntry = require("../ledger/ledger.model");
const ScenarioOutcome = require("../scenarioOutcome/scenarioOutcome.model");

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
  foreignField: "classId",
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
 * @param {string} classId - Class ID
 * @param {string} organizationId - Organization ID for scoping
 * @returns {Promise<Object>} Dashboard data
 */
classroomSchema.statics.getDashboard = async function (
  classId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classId,
    organization: organizationId,
  });

  if (!classDoc) {
    throw new Error("Class not found");
  }

  // Count students (members with role 'member')
  const studentCount = await Enrollment.countByClass(classId);

  // Get active scenario
  const activeScenario = await Scenario.getActiveScenario(classId);
  const activeScenarioData = activeScenario
    ? {
        ...activeScenario,
        id: activeScenario._id,
        week: activeScenario.week,
        title: activeScenario.title,
        description: activeScenario.description,
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
    { $match: { classId: new mongoose.Types.ObjectId(classId) } },
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
    classId,
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

/**
 * Get roster for a class
 * @param {string} classId - Class ID
 * @param {string} organizationId - Organization ID for scoping
 * @returns {Promise<Array>} Roster data with student info
 * @deprecated Use Enrollment.getClassRoster() instead
 */
classroomSchema.statics.getRoster = async function (classId, organizationId) {
  const classDoc = await this.findOne({
    _id: classId,
    organization: organizationId,
  });

  if (!classDoc) {
    throw new Error("Class not found");
  }

  // Delegate to Enrollment model
  return await Enrollment.getClassRoster(classId);
};

/**
 * Validate admin access to a class
 * @param {string} classId - Class ID
 * @param {string} clerkUserId - Clerk user ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Class document if admin, throws error otherwise
 */
classroomSchema.statics.validateAdminAccess = async function (
  classId,
  clerkUserId,
  organizationId
) {
  const classDoc = await this.findOne({
    _id: classId,
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
 * @param {string} classId - Class ID
 * @returns {string} Join link URL
 */
classroomSchema.statics.generateJoinLink = function (classId) {
  const baseUrl = process.env.SCALE_APP_HOST || "http://localhost:5173";
  return `${baseUrl}/class/${classId}/join`;
};

const Classroom = mongoose.model("Classroom", classroomSchema);

module.exports = Classroom;
