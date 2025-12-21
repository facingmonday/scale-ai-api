const Classroom = require("../classroom/classroom.model");
const Member = require("../members/member.model");
const Enrollment = require("./enrollment.model");

/**
 * Student joins class
 * POST /api/class/:classroomId/join
 */
exports.joinClass = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const clerkUserId = req.clerkUser.id;

    // Verify classroom exists and is active
    const classDoc = await Classroom.findById(classroomId);

    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    const organizationId = classDoc.organization;

    if (!classDoc.isActive) {
      return res.status(400).json({ error: "Class is not active" });
    }

    // Get member
    const member = await Member.findOne({ clerkUserId });
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Determine role (admin if in adminIds, otherwise member)
    const role = classDoc.isAdmin(clerkUserId) ? "admin" : "member";

    // Enroll user using Enrollment model
    const enrollment = await Enrollment.enrollUser(
      classroomId,
      member._id,
      role,
      organizationId,
      clerkUserId
    );

    // TODO: Trigger downstream initialization (store, variables)
    // This will be implemented when Store service exists

    res.status(201).json({
      success: true,
      message: "Joined class successfully",
      data: enrollment,
    });
  } catch (error) {
    console.error("Error joining class:", error);
    if (error.message === "User is already enrolled in this class") {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === "MongoServerError" && error.code === 11000) {
      return res.status(400).json({ error: "Already enrolled in this class" });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get class roster
 * GET /api/admin/class/:classroomId/roster?page=0&pageSize=50
 */
exports.getClassRoster = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 50;

    // Validate admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get roster using Enrollment model
    const roster = await Enrollment.getClassRoster(classroomId);

    // Apply pagination in controller
    const totalCount = roster.length;
    const skip = page * pageSize;
    const paginatedRoster = roster.slice(skip, skip + pageSize);
    const hasMore = skip + pageSize < totalCount;

    res.json({
      success: true,
      page,
      pageSize,
      total: totalCount,
      hasMore,
      data: paginatedRoster,
    });
  } catch (error) {
    console.error("Error getting class roster:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Remove student from class
 * DELETE /api/admin/class/:classroomId/student/:userId
 */
exports.removeStudent = async function (req, res) {
  try {
    const { classroomId, userId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Validate admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Remove enrollment using Enrollment model
    await Enrollment.removeEnrollment(classroomId, userId, clerkUserId);

    res.json({
      success: true,
      message: "Student removed successfully",
    });
  } catch (error) {
    console.error("Error removing student:", error);
    if (error.message === "Enrollment not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get my classrooms (classes I'm enrolled in or admin of)
 * GET /v1/enrollment/my-classes
 */
exports.getMyClasses = async function (req, res) {
  const clerkUserId = req.clerkUser.id;
  const organizationId = req.organization.id;

  const member = await Member.findOne({ clerkUserId });
  if (!member) {
    return res.json({ success: true, data: [] });
  }

  // Get enrollments
  const enrollments = await Enrollment.find({
    userId: member._id,
    isRemoved: false,
  }).populate("classroomId");

  const enrolledClassIds = enrollments.map((e) => e.classroomId);

  // Get classrooms where enrolled OR admin
  const classrooms = await Classroom.find({
    organization: organizationId,
    $or: [
      { _id: { $in: enrolledClassIds } }, // Enrolled
      { adminIds: clerkUserId }, // Admin (might not be enrolled yet)
    ],
  }).populate({
    path: "ownership",
    select: "firstName lastName",
  });

  // Enrich with user's relationship to each class
  const enrichedClassrooms = classrooms.map((classroom) => {
    const enrollment = enrollments.find(
      (e) => e.classroomId.toString() === classroom._id.toString()
    );

    return {
      ...classroom.toObject(),
      myRole: {
        isAdmin: classroom.isAdmin(clerkUserId),
        isEnrolled: !!enrollment,
        enrollmentRole: enrollment?.role || null,
      },
    };
  });

  res.json({ success: true, data: enrichedClassrooms });
};
