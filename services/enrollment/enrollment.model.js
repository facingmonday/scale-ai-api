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
  studentId: {
    type: String,
    trim: true,
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
  { unique: true, partialFilterExpression: { isRemoved: false } },
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
        membership.role === "org:member",
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
  clerkUserId,
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
        membership.role === "org:member",
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
      studentId: enrollment.studentId || profile?.studentId || "",
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
  clerkUserId,
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
  options = {},
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
  role,
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
  organizationId,
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
      (profileType &&
      profileType.label !== undefined &&
      profileType.label !== null
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
      profileType &&
      profileType.variables &&
      typeof profileType.variables === "object"
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

enrollmentSchema.statics.getActiveEnrollmentCountForUser = async function (
  userId,
  organizationId,
) {
  return this.countDocuments({
    userId,
    organization: organizationId,
    isRemoved: false,
  });
};

/**
 * Release all seat claims and remove enrollments when a user leaves an organization.
 */
enrollmentSchema.statics.releaseSeatsOnOrgRemoval = async function ({
  organizationId,
  userId,
  updatedBy,
}) {
  const Member = require("../members/member.model");
  const SeatClaim = require("../licensing/seatClaim.model");

  const enrollments = await this.find({
    userId,
    organization: organizationId,
    isRemoved: false,
  });

  let enrollmentsRemoved = 0;
  let orgSeatsReleased = 0;
  let studentSeatsHeld = 0;

  for (const enrollment of enrollments) {
    await this.removeEnrollment(enrollment.classroomId, userId, updatedBy);
    enrollmentsRemoved += 1;

    const seatRelease = await SeatClaim.releaseSeatOnRemoval({
      classroomId: enrollment.classroomId,
      userId,
      organizationId,
      updatedBy,
    });

    if (seatRelease.action === "released_to_org") {
      orgSeatsReleased += 1;
    } else if (seatRelease.action === "held") {
      studentSeatsHeld += 1;
    }
  }

  const activeClaims = await SeatClaim.find({
    organization: organizationId,
    userId,
    status: "active",
  });

  for (const claim of activeClaims) {
    const seatRelease = await SeatClaim.releaseSeatOnRemoval({
      classroomId: claim.classroomId,
      userId,
      organizationId,
      updatedBy,
    });

    if (seatRelease.action === "released_to_org") {
      orgSeatsReleased += 1;
    } else if (seatRelease.action === "held") {
      studentSeatsHeld += 1;
    }
  }

  const member = await Member.findById(userId);
  if (member?.activeClassroom?.classroomId) {
    await member.clearActiveClassroomIfMatches(member.activeClassroom.classroomId);
  }

  const heldCount = await SeatClaim.countDocuments({
    organization: organizationId,
    userId,
    status: "held",
    source: { $in: SeatClaim.STUDENT_PAID_SOURCES },
  });

  return {
    enrollmentsRemoved,
    orgSeatsReleased,
    studentSeatsHeld: Math.max(studentSeatsHeld, heldCount),
  };
};

/**
 * Grant an org seat to a student and enroll them in a classroom.
 */
enrollmentSchema.statics.grantOrgSeatAndEnroll = async function ({
  classroom,
  organization,
  member,
  source = "manual_comp",
  reason = "",
  grantedBy,
}) {
  const SeatClaim = require("../licensing/seatClaim.model");
  const SeatPool = require("../licensing/seatPool.model");
  const { makeLicensingError } = require("../licensing/licensing.errors");

  const GRANT_SOURCES = ["manual_comp", "teacher_assigned"];
  const grantSource = GRANT_SOURCES.includes(source) ? source : "manual_comp";

  const existingEnrollment = await this.findByClassAndUser(
    classroom._id,
    member._id,
  );
  if (existingEnrollment) {
    throw makeLicensingError(
      "Student is already enrolled in this classroom.",
      409,
      "ALREADY_ENROLLED",
    );
  }

  const existingClaim = await SeatClaim.findActiveClaim(
    classroom._id,
    member._id,
  );
  if (existingClaim) {
    const enrollment = await this.enrollUser(
      classroom._id,
      member._id,
      "member",
      organization._id,
      grantedBy,
    );
    return { claim: existingClaim, enrollment, decision: "already_claimed" };
  }

  const prepaidPool = await SeatPool.claimFloatingPrepaidSeatAtomically({
    organizationId: organization._id,
    createdBy: grantedBy,
  });

  if (!prepaidPool) {
    throw makeLicensingError(
      "No organization seats available to grant.",
      409,
      "NO_SEATS_AVAILABLE",
      { organizationId: organization._id },
    );
  }

  const { claim } = await SeatClaim.createClaim({
    classroom,
    member,
    source: grantSource,
    seatPool: prepaidPool,
    createdBy: grantedBy,
    metadata: {
      reason: reason || undefined,
      grantedBy,
      grantedAt: new Date().toISOString(),
    },
  });

  const enrollment = await this.enrollUser(
    classroom._id,
    member._id,
    "member",
    organization._id,
    grantedBy,
  );

  return { claim, enrollment, pool: prepaidPool, decision: grantSource };
};

/**
 * Ensures the final state is valid (auth/org/classroom/membership/enrollment) and returns it.
 */
enrollmentSchema.statics.ensureJoin = async function ({
  orgId,
  classroomId,
  clerkUserId,
  member,
  studentEmail,
  studentId,
  joinSource = "invite_link",
}) {
  const Organization = require("../organizations/organization.model");
  const Classroom = require("../classroom/classroom.model");
  const Member = require("../members/member.model");
  const SeatClaim = require("../licensing/seatClaim.model");
  const RosterSeat = require("../licensing/rosterSeat.model");

  const [organization, classroom] = await Promise.all([
    Organization.ensureByClerkId(orgId),
    Classroom.findById(classroomId),
  ]);

  if (!classroom) {
    const err = new Error("Classroom not found");
    err.statusCode = 404;
    throw err;
  }

  if (!classroom.isActive) {
    const err = new Error("Classroom is not active");
    err.statusCode = 400;
    throw err;
  }

  if (classroom.organization.toString() !== organization._id.toString()) {
    const err = new Error(
      "Invalid join request: classroom does not belong to organization",
    );
    err.statusCode = 400;
    throw err;
  }

  const existingClerkMembership = await Member.getExistingClerkOrgMembership(
    orgId,
    clerkUserId,
  );

  const isOrgAdmin = existingClerkMembership?.role === "org:admin";
  const isOwner =
    classroom.ownership?.toString?.() &&
    member?._id?.toString?.() &&
    classroom.ownership.toString() === member._id.toString();
  const role = isOrgAdmin || isOwner ? "admin" : "member";

  let rosterStudentId;
  if (role === "member") {
    const { claim } = await SeatClaim.claimSeatOrRequireCheckout({
      classroom,
      organization,
      member,
      clerkUserId,
      studentEmail,
      studentId,
      joinSource,
    });

    let rosterSeat;
    if (claim?.rosterSeatId) {
      rosterSeat = await RosterSeat.findOne({
        _id: claim.rosterSeatId,
        classroomId: classroom._id,
        organization: organization._id,
      })
        .select("studentId")
        .lean();
    }

    if (!rosterSeat && studentEmail) {
      rosterSeat = await RosterSeat.findOne({
        classroomId: classroom._id,
        organization: organization._id,
        email: studentEmail.trim().toLowerCase(),
        status: { $ne: "revoked" },
      })
        .select("studentId")
        .lean();
    }

    rosterStudentId = rosterSeat?.studentId || undefined;
  }

  const clerkMembership = await Member.getOrCreateClerkOrgMembership(
    orgId,
    clerkUserId,
  );
  await Member.syncOrgMembership(member, organization, clerkMembership);

  let enrollment = await this.findOne({
    classroomId: classroom._id,
    userId: member._id,
  });

  if (enrollment && !enrollment.isRemoved) {
    if (!enrollment.studentId && rosterStudentId) {
      enrollment.studentId = rosterStudentId;
      enrollment.updatedBy = clerkUserId;
      await enrollment.save();
    }
    return { organization, classroom, enrollment };
  }

  if (enrollment && enrollment.isRemoved) {
    enrollment.restore();
    enrollment.role = role;
    enrollment.organization = organization._id;
    enrollment.studentId = rosterStudentId;
    enrollment.updatedBy = clerkUserId;
    await enrollment.save();
    return { organization, classroom, enrollment };
  }

  enrollment = new this({
    classroomId: classroom._id,
    userId: member._id,
    role,
    studentId: rosterStudentId,
    joinedAt: new Date(),
    organization: organization._id,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await enrollment.save();
  return { organization, classroom, enrollment };
};

/**
 * Remove a user from a classroom and release their seat
 * @param {Object} options
 * @param {string} options.classroomId
 * @param {string} options.userId
 * @param {string} options.organizationId
 * @param {string} options.updatedBy
 * @param {boolean} [options.allowAdminEnrollment=false]
 * @returns {Promise<Object>} Removed enrollment and seat release result
 */
enrollmentSchema.statics.leaveClassroom = async function ({
  classroomId,
  userId,
  organizationId,
  updatedBy,
  allowAdminEnrollment = false,
}) {
  const Member = require("../members/member.model");
  const SeatClaim = require("../licensing/seatClaim.model");
  const { makeLeaveError } = require("./leave.errors");

  const enrollment = await this.findByClassAndUser(classroomId, userId);
  if (!enrollment) {
    throw makeLeaveError("Enrollment not found.", 404, "NOT_ENROLLED");
  }

  if (!allowAdminEnrollment && enrollment.role === "admin") {
    throw makeLeaveError(
      "Classroom admins cannot leave via this action.",
      403,
      "ADMIN_CANNOT_LEAVE",
    );
  }

  const member = await Member.findById(userId);

  const removedEnrollment = await this.removeEnrollment(
    classroomId,
    userId,
    updatedBy,
  );

  const seatRelease = await SeatClaim.releaseSeatOnRemoval({
    classroomId,
    userId,
    organizationId,
    updatedBy,
  });

  if (member) {
    await member.clearActiveClassroomIfMatches(classroomId);
  }

  return {
    enrollment: removedEnrollment,
    seatRelease,
  };
};

/**
 * Move a student from one classroom to another within the same organization.
 * The student's active org seat claim moves with them (usedSeats unchanged).
 * @param {Object} options
 * @param {string} options.organizationId
 * @param {string} options.fromClassroomId
 * @param {string} options.toClassroomId
 * @param {string} options.userId
 * @param {string} options.performedByClerkUserId
 * @returns {Promise<Object>} Transfer result
 */
enrollmentSchema.statics.transferStudentBetweenClassrooms = async function ({
  organizationId,
  fromClassroomId,
  toClassroomId,
  userId,
  performedByClerkUserId,
}) {
  const Classroom = require("../classroom/classroom.model");
  const Member = require("../members/member.model");
  const SeatClaim = require("../licensing/seatClaim.model");
  const OrgSeatReservation = require("../licensing/orgSeatReservation.model");
  const RosterSeat = require("../licensing/rosterSeat.model");
  const { makeTransferError } = require("./transfer.errors");

  if (fromClassroomId.toString() === toClassroomId.toString()) {
    throw makeTransferError(
      "Source and target classrooms must be different.",
      400,
      "SAME_CLASSROOM",
    );
  }

  const [fromClassroom, toClassroom, member] = await Promise.all([
    Classroom.findOne({ _id: fromClassroomId, organization: organizationId }),
    Classroom.findOne({ _id: toClassroomId, organization: organizationId }),
    Member.findById(userId),
  ]);

  if (!fromClassroom) {
    throw makeTransferError(
      "Source classroom not found.",
      404,
      "SOURCE_NOT_FOUND",
    );
  }
  if (!toClassroom) {
    throw makeTransferError(
      "Target classroom not found.",
      404,
      "TARGET_NOT_FOUND",
    );
  }
  if (!toClassroom.isActive) {
    throw makeTransferError(
      "Target classroom is not active.",
      400,
      "TARGET_INACTIVE",
    );
  }
  if (!member) {
    throw makeTransferError("Student not found.", 404, "STUDENT_NOT_FOUND");
  }

  const sourceEnrollment = await this.findOne({
    classroomId: fromClassroomId,
    userId: member._id,
    isRemoved: false,
  });
  if (!sourceEnrollment) {
    throw makeTransferError(
      "Student is not enrolled in the source classroom.",
      404,
      "NOT_ENROLLED_IN_SOURCE",
    );
  }

  const existingTargetEnrollment = await this.findOne({
    classroomId: toClassroomId,
    userId: member._id,
    isRemoved: false,
  });
  if (existingTargetEnrollment) {
    throw makeTransferError(
      "Student is already enrolled in the target classroom.",
      409,
      "ALREADY_ENROLLED_IN_TARGET",
    );
  }

  const seatClaim = await SeatClaim.findActiveClaim(
    fromClassroomId,
    member._id,
  );

  sourceEnrollment.softRemove();
  sourceEnrollment.updatedBy = performedByClerkUserId;
  await sourceEnrollment.save();

  let targetEnrollment = await this.findOne({
    classroomId: toClassroomId,
    userId: member._id,
  });

  if (targetEnrollment?.isRemoved) {
    targetEnrollment.restore();
    targetEnrollment.role = "member";
    targetEnrollment.organization = organizationId;
    targetEnrollment.updatedBy = performedByClerkUserId;
    await targetEnrollment.save();
  } else if (!targetEnrollment) {
    targetEnrollment = await this.enrollUser(
      toClassroomId,
      member._id,
      "member",
      organizationId,
      performedByClerkUserId,
    );
  }

  let transferredSeat = null;
  if (seatClaim) {
    await RosterSeat.releaseForClaim(seatClaim, performedByClerkUserId);

    seatClaim.classroomId = toClassroom._id;
    seatClaim.rosterSeatId = undefined;
    seatClaim.updatedBy = performedByClerkUserId;
    seatClaim.metadata = {
      ...(seatClaim.metadata || {}),
      transferredFrom: fromClassroomId.toString(),
      transferredAt: new Date().toISOString(),
      transferredBy: performedByClerkUserId,
    };

    await RosterSeat.attachForClaim({
      claim: seatClaim,
      member,
      classroomId: toClassroom._id,
      updatedBy: performedByClerkUserId,
    });

    await seatClaim.save();

    if (seatClaim.orgSeatReservationId) {
      await OrgSeatReservation.findByIdAndUpdate(
        seatClaim.orgSeatReservationId,
        {
          $set: {
            claimedClassroomId: toClassroom._id,
            updatedBy: performedByClerkUserId,
          },
        },
      );
    } else {
      await OrgSeatReservation.findOneAndUpdate(
        {
          organization: organizationId,
          claimedBy: member._id,
          status: "claimed",
          claimedClassroomId: fromClassroomId,
        },
        {
          $set: {
            claimedClassroomId: toClassroom._id,
            updatedBy: performedByClerkUserId,
          },
        },
      );
    }

    transferredSeat = seatClaim;
  }

  await member.updateActiveClassroomForTransfer({
    fromClassroomId,
    toClassroom,
    enrollmentRole: targetEnrollment.role,
  });

  return {
    fromClassroomId,
    toClassroomId,
    userId: member._id,
    enrollment: targetEnrollment,
    seatClaim: transferredSeat,
  };
};

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

module.exports = Enrollment;
