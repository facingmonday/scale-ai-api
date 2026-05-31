const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const enrollmentSchema = new mongoose.Schema({
  classroomId: {
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
  { classroomId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { isRemoved: false } }
);
enrollmentSchema.index({ classroomId: 1, role: 1 });
enrollmentSchema.index({ classroomId: 1, isRemoved: 1 });
enrollmentSchema.index({ userId: 1, isRemoved: 1 });
enrollmentSchema.index({ organization: 1, classroomId: 1 });

// Static methods
enrollmentSchema.statics.findByClass = function (classroomId, options = {}) {
  const query = { classroomId, isRemoved: false };
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

enrollmentSchema.statics.findByClassAndUser = function (classroomId, userId) {
  return this.findOne({ classroomId, userId, isRemoved: false });
};

enrollmentSchema.statics.findByClassAndRole = function (classroomId, role) {
  return this.find({ classroomId, role, isRemoved: false });
};

enrollmentSchema.statics.countByClass = async function (classroomId) {
  const Classroom = require("../classroom/classroom.model");

  // Get classroom to access organization
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    throw new Error("Class not found");
  }

  const organizationId = classroom.organization;

  // Get all enrollments and populate member with organizationMemberships
  const enrollments = await this.findByClass(classroomId).populate({
    path: "userId",
    select: "organizationMemberships",
  });

  // Filter to only include members with org:member role in this organization
  const filteredEnrollments = enrollments.filter((enrollment) => {
    const member = enrollment.userId;
    if (!member || !member.organizationMemberships) {
      return false;
    }

    // Check if member has org:member role in this organization
    const orgMembership = member.organizationMemberships.find(
      (membership) =>
        membership.organizationId.toString() === organizationId.toString() &&
        membership.role === "org:member"
    );

    return !!orgMembership;
  });

  return filteredEnrollments.length;
};

/**
 * Enroll a user into a class
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID (ObjectId)
 * @param {string} role - Role ("admin" or "member")
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Enrollment document
 */
enrollmentSchema.statics.enrollUser = async function (
  classroomId,
  userId,
  role = "member",
  organizationId,
  clerkUserId
) {
  // Check if already enrolled
  const existing = await this.findByClassAndUser(classroomId, userId);
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
    classroomId,
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
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<boolean>} True if enrolled
 */
enrollmentSchema.statics.isUserEnrolled = async function (classroomId, userId) {
  const enrollment = await this.findByClassAndUser(classroomId, userId);
  return !!enrollment;
};

/**
 * Get user's role in a class
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<string|null>} Role ("admin" or "member") or null if not enrolled
 */
enrollmentSchema.statics.getUserRole = async function (classroomId, userId) {
  const enrollment = await this.findByClassAndUser(classroomId, userId);
  return enrollment ? enrollment.role : null;
};

/**
 * Require admin role - throws error if user is not admin
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<void>} Throws error if not admin
 */
enrollmentSchema.statics.requireAdmin = async function (classroomId, userId) {
  const role = await this.getUserRole(classroomId, userId);
  if (role !== "admin") {
    throw new Error("Insufficient permissions: Admin access required");
  }
};

/**
 * Get class roster
 * @param {string} classroomId - Class ID
 * @returns {Promise<Array>} Roster array with user info and profile (only org:member role)
 */
enrollmentSchema.statics.getClassRoster = async function (classroomId) {
  const Classroom = require("../classroom/classroom.model");
  const Profile = require("../profile/profile.model");

  // Get classroom to access organization
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    throw new Error("Class not found");
  }

  const organizationId = classroom.organization;

  // Get all enrollments and populate member with organizationMemberships
  const enrollments = await this.findByClass(classroomId).populate({
    path: "userId",
    select:
      "firstName lastName clerkUserId maskedEmail email organizationMemberships",
  });

  // Filter to only include members with org:member role in this organization
  const filteredEnrollments = enrollments.filter((enrollment) => {
    const member = enrollment.userId;
    if (!member || !member.organizationMemberships) {
      return false;
    }

    // Check if member has org:member role in this organization
    const orgMembership = member.organizationMemberships.find(
      (membership) =>
        membership.organizationId.toString() === organizationId.toString() &&
        membership.role === "org:member"
    );

    return !!orgMembership;
  });

  // Get all profiles for this classroom
  const profiles = await Profile.getStoresByClass(classroomId);

  // Create a map of userId -> profile for quick lookup
  const storeMap = new Map();
  profiles.forEach((profile) => {
    // getStoresByClass already returns plain objects, but userId might be ObjectId
    const userId = profile.userId?.toString
      ? profile.userId.toString()
      : String(profile.userId);
    storeMap.set(userId, profile);
  });

  return filteredEnrollments.map((enrollment) => {
    const member = enrollment.userId;
    const displayName = member
      ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown"
      : "Unknown";

    // Get profile for this user
    const profile = member?._id
      ? storeMap.get(member._id.toString()) || null
      : null;

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
      profile,
    };
  });
};

/**
 * Remove enrollment (soft delete)
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated enrollment
 */
enrollmentSchema.statics.removeEnrollment = async function (
  classroomId,
  userId,
  clerkUserId
) {
  const enrollment = await this.findOne({
    classroomId,
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
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Enrollment or null
 */
enrollmentSchema.statics.getEnrollment = function (classroomId, userId) {
  return this.findByClassAndUser(classroomId, userId);
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
 * @param {string} classroomId - Class ID
 * @param {string} role - Role ("admin" or "member")
 * @returns {Promise<Array>} Array of enrollments
 */
enrollmentSchema.statics.getEnrollmentsByClassAndRole = function (
  classroomId,
  role
) {
  return this.findByClassAndRole(classroomId, role);
};

/**
 * Process roster export - generates CSV with all enrolled students
 * @param {string} classroomId - Classroom ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Export result with csv and total
 */
enrollmentSchema.statics.processRosterExport = async function (
  classroomId,
  organizationId
) {
  const { Parser } = require("json2csv");

  // Get roster data
  const roster = await this.getClassRoster(classroomId);

  // If no roster entries, return empty result
  if (roster.length === 0) {
    throw new Error("No students found in roster");
  }

  const asString = (v) => {
    if (v === undefined || v === null) return "";
    if (v instanceof Date) return v.toISOString();
    return String(v);
  };

  const asIsoDate = (v) => {
    if (!v) return "";
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  };

  const asJson = (v) => {
    if (!v || typeof v !== "object") return "";
    try {
      return JSON.stringify(v);
    } catch (e) {
      return "";
    }
  };

  // Build a strict, safe export shape (no ObjectIds / no Clerk ids / no internal metadata)
  const csvRows = roster.map((item) => {
    const profile = item.profile || null;
    const profileType =
      profile && typeof profile.profileType === "object" && profile.profileType
        ? profile.profileType
        : null;

    // ProfileType label/description should come from the populated profileType doc when available,
    // else fall back to the backward-compatible top-level storeTypeLabel/storeTypeKey.
    const storeTypeLabel =
      (profileType && profileType.label !== undefined && profileType.label !== null
        ? profileType.label
        : profile?.storeTypeLabel || profile?.storeTypeKey) || "";
    const storeTypeDescription =
      profileType &&
      profileType.description !== undefined &&
      profileType.description !== null
        ? profileType.description
        : "";
    const storeTypeKey =
      (profileType && profileType.key !== undefined && profileType.key !== null
        ? profileType.key
        : profile?.storeTypeKey) || "";

    const storeVariables =
      profile && profile.variables && typeof profile.variables === "object"
        ? profile.variables
        : null;
    const storeTypeVariables =
      profileType && profileType.variables && typeof profileType.variables === "object"
        ? profileType.variables
        : null;

    return {
      // Profile (priority order)
      storeStudentId: asString(profile?.studentId),
      storeShopName: asString(profile?.shopName),
      storeDescription: asString(profile?.storeDescription),
      storeTypeLabel: asString(storeTypeLabel),
      storeTypeDescription: asString(storeTypeDescription),

      // Member
      memberFirstName: asString(item.firstName),
      memberLastName: asString(item.lastName),
      memberDisplayName: asString(item.displayName),
      memberEmail: asString(item.email),

      // Enrollment
      enrollmentRole: asString(item.role),
      enrollmentJoinedAt: asIsoDate(item.joinedAt),

      // Other profile info
      storeLocation: asString(profile?.storeLocation),
      storeImageUrl: asString(profile?.imageUrl),
      storeTypeKey: asString(storeTypeKey),

      // Variable maps (kept as JSON to avoid exploding columns and to prevent ObjectId leakage)
      storeVariablesJson: asJson(storeVariables),
      storeTypeVariablesJson: asJson(storeTypeVariables),
    };
  });

  // Generate CSV with explicit, ordered columns (prevents ObjectId -> *_buffer_* leakage)
  const fields = [
    { label: "profile.studentId", value: "storeStudentId" },
    { label: "profile.shopName", value: "storeShopName" },
    { label: "profile.storeDescription", value: "storeDescription" },
    { label: "profileType.label", value: "storeTypeLabel" },
    { label: "profileType.description", value: "storeTypeDescription" },

    { label: "member.firstName", value: "memberFirstName" },
    { label: "member.lastName", value: "memberLastName" },
    { label: "member.displayName", value: "memberDisplayName" },
    { label: "member.email", value: "memberEmail" },

    { label: "enrollment.role", value: "enrollmentRole" },
    { label: "enrollment.joinedAt", value: "enrollmentJoinedAt" },

    { label: "profile.storeLocation", value: "storeLocation" },
    { label: "profile.imageUrl", value: "storeImageUrl" },
    { label: "profileType.key", value: "storeTypeKey" },

    { label: "profile.variablesJson", value: "storeVariablesJson" },
    { label: "profileType.variablesJson", value: "storeTypeVariablesJson" },
  ];

  const parser = new Parser({
    fields,
    withBOM: true,
  });
  const csv = parser.parse(csvRows);

  // Generate filename with classroom ID and timestamp
  const timestamp = Date.now();
  const fileName = `roster_${classroomId}_export_${timestamp}.csv`;

  return {
    csv,
    fileName,
    total: csvRows.length,
  };
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
