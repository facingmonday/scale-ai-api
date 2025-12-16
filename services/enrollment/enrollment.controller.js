const Classroom = require("../classroom/classroom.model");
const Member = require("../members/member.model");
const enrollmentService = require("./lib/enrollmentService");
const classroomService = require("../classroom/lib/classroomService");

/**
 * Student joins class
 * POST /api/class/:classId/join
 */
exports.joinClass = async function (req, res) {
  try {
    const { classId } = req.params;
    const clerkUserId = req.clerkUser.id;

    // Verify classroom exists and is active
    const classDoc = await Classroom.findById(classId);

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

    // Enroll user using enrollment service
    const enrollment = await enrollmentService.enrollUser(
      classId,
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
 * GET /api/admin/class/:classId/roster
 */
exports.getClassRoster = async function (req, res) {
  try {
    const { classId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Validate admin access
    await classroomService.validateAdminAccess(
      classId,
      clerkUserId,
      organizationId
    );

    // Get roster using enrollment service
    const roster = await enrollmentService.getClassRoster(classId);

    res.json({
      success: true,
      data: roster,
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
 * DELETE /api/admin/class/:classId/student/:userId
 */
exports.removeStudent = async function (req, res) {
  try {
    const { classId, userId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Validate admin access
    await classroomService.validateAdminAccess(
      classId,
      clerkUserId,
      organizationId
    );

    // Remove enrollment using enrollment service
    await enrollmentService.removeEnrollment(classId, userId, clerkUserId);

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
