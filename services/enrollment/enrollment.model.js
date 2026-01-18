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
 * @returns {Promise<Array>} Roster array with user info and store (only org:member role)
 */
enrollmentSchema.statics.getClassRoster = async function (classroomId) {
  const Classroom = require("../classroom/classroom.model");
  const Store = require("../store/store.model");

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

  // Get all stores for this classroom
  const stores = await Store.getStoresByClass(classroomId);

  // Create a map of userId -> store for quick lookup
  const storeMap = new Map();
  stores.forEach((store) => {
    // getStoresByClass already returns plain objects, but userId might be ObjectId
    const userId = store.userId?.toString
      ? store.userId.toString()
      : String(store.userId);
    storeMap.set(userId, store);
  });

  return filteredEnrollments.map((enrollment) => {
    const member = enrollment.userId;
    const displayName = member
      ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown"
      : "Unknown";

    // Get store for this user
    const store = member?._id
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
      store,
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
    const store = item.store || null;
    const storeType =
      store && typeof store.storeType === "object" && store.storeType
        ? store.storeType
        : null;

    // StoreType label/description should come from the populated storeType doc when available,
    // else fall back to the backward-compatible top-level storeTypeLabel/storeTypeKey.
    const storeTypeLabel =
      (storeType && storeType.label !== undefined && storeType.label !== null
        ? storeType.label
        : store?.storeTypeLabel || store?.storeTypeKey) || "";
    const storeTypeDescription =
      storeType &&
      storeType.description !== undefined &&
      storeType.description !== null
        ? storeType.description
        : "";
    const storeTypeKey =
      (storeType && storeType.key !== undefined && storeType.key !== null
        ? storeType.key
        : store?.storeTypeKey) || "";

    const storeVariables =
      store && store.variables && typeof store.variables === "object"
        ? store.variables
        : null;
    const storeTypeVariables =
      storeType && storeType.variables && typeof storeType.variables === "object"
        ? storeType.variables
        : null;

    return {
      // Store (priority order)
      storeStudentId: asString(store?.studentId),
      storeShopName: asString(store?.shopName),
      storeDescription: asString(store?.storeDescription),
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

      // Other store info
      storeLocation: asString(store?.storeLocation),
      storeImageUrl: asString(store?.imageUrl),
      storeTypeKey: asString(storeTypeKey),

      // Variable maps (kept as JSON to avoid exploding columns and to prevent ObjectId leakage)
      storeVariablesJson: asJson(storeVariables),
      storeTypeVariablesJson: asJson(storeTypeVariables),
    };
  });

  // Generate CSV with explicit, ordered columns (prevents ObjectId -> *_buffer_* leakage)
  const fields = [
    { label: "store.studentId", value: "storeStudentId" },
    { label: "store.shopName", value: "storeShopName" },
    { label: "store.storeDescription", value: "storeDescription" },
    { label: "storeType.label", value: "storeTypeLabel" },
    { label: "storeType.description", value: "storeTypeDescription" },

    { label: "member.firstName", value: "memberFirstName" },
    { label: "member.lastName", value: "memberLastName" },
    { label: "member.displayName", value: "memberDisplayName" },
    { label: "member.email", value: "memberEmail" },

    { label: "enrollment.role", value: "enrollmentRole" },
    { label: "enrollment.joinedAt", value: "enrollmentJoinedAt" },

    { label: "store.storeLocation", value: "storeLocation" },
    { label: "store.imageUrl", value: "storeImageUrl" },
    { label: "storeType.key", value: "storeTypeKey" },

    { label: "store.variablesJson", value: "storeVariablesJson" },
    { label: "storeType.variablesJson", value: "storeTypeVariablesJson" },
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
