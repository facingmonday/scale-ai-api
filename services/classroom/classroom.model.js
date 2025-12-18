const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const Enrollment = require("../enrollment/enrollment.model");

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

  // Get active scenario (placeholder - will be implemented when Scenario service exists)
  const activeScenario = null; // TODO: Implement when Scenario model exists

  // Count completed submissions (placeholder - will be implemented when Submission service exists)
  const submissionsCompleted = 0; // TODO: Implement when Submission model exists

  // Get leaderboard top 3 (placeholder - will be implemented when Ledger service exists)
  const leaderboardTop3 = []; // TODO: Implement when Ledger model exists

  // Get pending approvals (placeholder - will be implemented when Scenario service exists)
  const pendingApprovals = 0; // TODO: Implement when Scenario model exists

  return {
    className: classDoc.name,
    classDescription: classDoc.description,
    isActive: classDoc.isActive,
    students: studentCount,
    activeScenario: activeScenario,
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
