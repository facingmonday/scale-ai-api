const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const enrollmentSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ["admin", "member"],
    required: true,
    default: "member",
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  // Soft delete flag
  isRemoved: {
    type: Boolean,
    default: false,
  },
  removedAt: {
    type: Date,
    default: null,
  },
}).add(baseSchema);

// Compound indexes for common queries
// Partial unique index - only enforce uniqueness for non-removed enrollments
enrollmentSchema.index(
  { classId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { isRemoved: false } }
);
enrollmentSchema.index({ classId: 1, role: 1 });
enrollmentSchema.index({ classId: 1, isRemoved: 1 });
enrollmentSchema.index({ userId: 1, isRemoved: 1 });
enrollmentSchema.index({ organization: 1, classId: 1 });

// Static methods
enrollmentSchema.statics.findByClass = function (classId, options = {}) {
  const query = { classId, isRemoved: false };
  if (options.includeRemoved) {
    delete query.isRemoved;
  }
  return this.find(query);
};

enrollmentSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId, isRemoved: false };
  if (options.includeRemoved) {
    delete query.isRemoved;
  }
  return this.find(query);
};

enrollmentSchema.statics.findByClassAndUser = function (classId, userId) {
  return this.findOne({ classId, userId, isRemoved: false });
};

enrollmentSchema.statics.findByClassAndRole = function (classId, role) {
  return this.find({ classId, role, isRemoved: false });
};

enrollmentSchema.statics.countByClass = function (classId) {
  return this.countDocuments({ classId, isRemoved: false });
};

/**
 * Enroll a user into a class
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID (ObjectId)
 * @param {string} role - Role ("admin" or "member")
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Enrollment document
 */
enrollmentSchema.statics.enrollUser = async function (
  classId,
  userId,
  role = "member",
  organizationId,
  clerkUserId
) {
  // Check if already enrolled
  const existing = await this.findByClassAndUser(classId, userId);
  if (existing) {
    if (existing.isRemoved) {
      // Restore enrollment
      existing.restore();
      existing.role = role; // Update role if changed
      existing.updatedBy = clerkUserId;
      await existing.save();
      return existing;
    }
    throw new Error("User is already enrolled in this class");
  }

  // Create new enrollment
  const enrollment = new this({
    classId,
    userId,
    role,
    joinedAt: new Date(),
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await enrollment.save();
  return enrollment;
};

/**
 * Check if user is enrolled in a class
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<boolean>} True if enrolled
 */
enrollmentSchema.statics.isUserEnrolled = async function (classId, userId) {
  const enrollment = await this.findByClassAndUser(classId, userId);
  return !!enrollment;
};

/**
 * Get user's role in a class
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<string|null>} Role ("admin" or "member") or null if not enrolled
 */
enrollmentSchema.statics.getUserRole = async function (classId, userId) {
  const enrollment = await this.findByClassAndUser(classId, userId);
  return enrollment ? enrollment.role : null;
};

/**
 * Require admin role - throws error if user is not admin
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<void>} Throws error if not admin
 */
enrollmentSchema.statics.requireAdmin = async function (classId, userId) {
  const role = await this.getUserRole(classId, userId);
  if (role !== "admin") {
    throw new Error("Insufficient permissions: Admin access required");
  }
};

/**
 * Get class roster
 * @param {string} classId - Class ID
 * @returns {Promise<Array>} Roster array with user info
 */
enrollmentSchema.statics.getClassRoster = async function (classId) {
  const enrollments = await this.findByClass(classId).populate({
    path: "userId",
    select: "firstName lastName clerkUserId maskedEmail email",
  });

  return enrollments.map((enrollment) => {
    const member = enrollment.userId;
    const displayName = member
      ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown"
      : "Unknown";

    return {
      enrollmentId: enrollment._id,
      userId: member?._id,
      clerkUserId: member?.clerkUserId,
      email: member?.maskedEmail || member?.email || "",
      displayName,
      firstName: member?.firstName || "",
      lastName: member?.lastName || "",
      role: enrollment.role,
      joinedAt: enrollment.joinedAt,
    };
  });
};

/**
 * Remove enrollment (soft delete)
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated enrollment
 */
enrollmentSchema.statics.removeEnrollment = async function (
  classId,
  userId,
  clerkUserId
) {
  const enrollment = await this.findOne({
    classId,
    userId,
    isRemoved: false,
  });

  if (!enrollment) {
    throw new Error("Enrollment not found");
  }

  enrollment.softRemove();
  enrollment.updatedBy = clerkUserId;
  await enrollment.save();

  return enrollment;
};

/**
 * Get enrollment by class and user
 * @param {string} classId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Enrollment or null
 */
enrollmentSchema.statics.getEnrollment = function (classId, userId) {
  return this.findByClassAndUser(classId, userId);
};

/**
 * Get enrollments by user
 * @param {string} userId - Member ID
 * @param {Object} options - Options (includeRemoved)
 * @returns {Promise<Array>} Array of enrollments
 */
enrollmentSchema.statics.getEnrollmentsByUser = function (
  userId,
  options = {}
) {
  return this.findByUser(userId, options);
};

/**
 * Get enrollments by class and role
 * @param {string} classId - Class ID
 * @param {string} role - Role ("admin" or "member")
 * @returns {Promise<Array>} Array of enrollments
 */
enrollmentSchema.statics.getEnrollmentsByClassAndRole = function (
  classId,
  role
) {
  return this.findByClassAndRole(classId, role);
};

// Instance methods
enrollmentSchema.methods.softRemove = function () {
  this.isRemoved = true;
  this.removedAt = new Date();
  return this;
};

enrollmentSchema.methods.restore = function () {
  this.isRemoved = false;
  this.removedAt = null;
  return this;
};

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

module.exports = Enrollment;
