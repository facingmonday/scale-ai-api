const Classroom = require("../classroom/classroom.model");
const Member = require("../members/member.model");
const Enrollment = require("./enrollment.model");
const Organization = require("../organizations/organization.model");

/**
 * Student joins class
 * POST /api/class/:classroomId/join
 */
exports.joinClass = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const { studentId } = req.body || {};
    const clerkUserId = req.clerkUser.id;

    // Verify classroom exists and is active
    const classDoc = await Classroom.findById(classroomId);

    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    if (!classDoc.isActive) {
      return res.status(400).json({ error: "Class is not active" });
    }

    // Get member
    const member = await Member.findOne({ clerkUserId });
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Translate classroom.organization (DB id) -> Clerk org id, then reuse the single join flow.
    const organization = await Organization.findById(classDoc.organization);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const clerkUser = req.clerkUser;
    const primaryEmailObj = clerkUser?.emailAddresses?.find(
      (email) => email.id === clerkUser?.primaryEmailAddressId
    );
    const studentEmail = primaryEmailObj?.emailAddress;

    const { enrollment } = await Enrollment.ensureJoin({
      orgId: organization.clerkOrganizationId,
      classroomId,
      clerkUserId,
      member,
      studentEmail,
      studentId,
      joinSource: "classroom_list",
    });

    // TODO: Trigger downstream initialization (profile, variables)
    // This will be implemented when Profile service exists

    res.status(200).json({
      success: true,
      message: "Joined class successfully",
      data: enrollment,
    });
  } catch (error) {
    console.error("Error joining class:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === "MongoServerError" && error.code === 11000) {
      return res.status(400).json({ error: "Already enrolled in this class" });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get class roster
 * GET /api/admin/class/:classroomId/roster?page=0&pageSize=50&search=term&sortBy=name&sortOrder=asc
 * Query params:
 *   - page: Page number (default: 0)
 *   - pageSize: Items per page (default: 50)
 *   - search: Search by name, email, studentId, or profile name (optional)
 *   - sortBy: Field to sort by - "name", "email", "studentId", "storeName", "joinedAt" (default: "name")
 *   - sortOrder: "asc" or "desc" (default: "asc")
 */
exports.getClassRoster = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const searchTerm = (req.query.search || "").trim();

    // Parse sort parameters
    const sortBy = req.query.sortBy || "name";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;

    // Validate admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get roster using Enrollment model
    let roster = await Enrollment.getClassRoster(classroomId);

    // Apply search filter if provided
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      roster = roster.filter((student) => {
        const firstName = (student.firstName || "").toLowerCase();
        const lastName = (student.lastName || "").toLowerCase();
        const displayName = (student.displayName || "").toLowerCase();
        const email = (student.email || "").toLowerCase();
        const studentId = (student.studentId || "").toLowerCase();
        const storeName = (student.profile?.shopName || "").toLowerCase();

        // Match if search term is found in any of these fields
        return (
          firstName.includes(searchLower) ||
          lastName.includes(searchLower) ||
          displayName.includes(searchLower) ||
          email.includes(searchLower) ||
          studentId.includes(searchLower) ||
          storeName.includes(searchLower) ||
          `${firstName} ${lastName}`.includes(searchLower)
        );
      });
    }

    // Apply sorting
    if (sortBy === "name") {
      roster.sort((a, b) => {
        const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim() || "";
        const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim() || "";
        return nameA.localeCompare(nameB) * sortOrder;
      });
    } else if (sortBy === "email") {
      roster.sort((a, b) => {
        const emailA = (a.email || "").toLowerCase();
        const emailB = (b.email || "").toLowerCase();
        return emailA.localeCompare(emailB) * sortOrder;
      });
    } else if (sortBy === "studentId") {
      roster.sort((a, b) => {
        const studentIdA = (a.studentId || "").toLowerCase();
        const studentIdB = (b.studentId || "").toLowerCase();
        return studentIdA.localeCompare(studentIdB) * sortOrder;
      });
    } else if (sortBy === "storeName") {
      roster.sort((a, b) => {
        const storeNameA = (a.profile?.shopName || "").toLowerCase();
        const storeNameB = (b.profile?.shopName || "").toLowerCase();
        return storeNameA.localeCompare(storeNameB) * sortOrder;
      });
    } else if (sortBy === "joinedAt") {
      roster.sort((a, b) => {
        const dateA = a.joinedAt ? new Date(a.joinedAt) : new Date(0);
        const dateB = b.joinedAt ? new Date(b.joinedAt) : new Date(0);
        return (dateA - dateB) * sortOrder;
      });
    }

    // Apply pagination
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
      sortBy,
      sortOrder: sortOrder === 1 ? "asc" : "desc",
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

    const { seatRelease } = await Enrollment.leaveClassroom({
      classroomId,
      userId,
      organizationId,
      updatedBy: clerkUserId,
      allowAdminEnrollment: true,
    });

    res.json({
      success: true,
      message: "Student removed successfully",
      data: {
        seatRelease: {
          action: seatRelease.action,
          claimId: seatRelease.claim?._id || null,
        },
      },
    });
  } catch (error) {
    console.error("Error removing student:", error);
    if (error.message === "Enrollment not found" || error.message === "Enrollment not found.") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update classroom-specific enrollment data for a student.
 * PATCH /v1/enrollment/admin/class/:classroomId/student/:userId
 */
exports.updateStudentEnrollment = async function (req, res) {
  try {
    const { classroomId, userId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (typeof req.body?.studentId !== "string") {
      return res.status(400).json({ error: "studentId must be a string" });
    }

    const studentId = req.body.studentId.trim();
    if (studentId.length > 20) {
      return res.status(400).json({
        error: "studentId must be 20 characters or fewer",
      });
    }

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId,
    );

    const enrollment = await Enrollment.findOne({
      classroomId,
      userId,
      organization: organizationId,
      isRemoved: false,
    });

    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    enrollment.studentId = studentId || undefined;
    enrollment.updatedBy = clerkUserId;
    await enrollment.save();

    return res.json({
      success: true,
      message: "Enrollment updated successfully",
      data: {
        _id: enrollment._id,
        classroomId: enrollment.classroomId,
        userId: enrollment.userId,
        role: enrollment.role,
        studentId: enrollment.studentId || "",
        joinedAt: enrollment.joinedAt,
      },
    });
  } catch (error) {
    console.error("Error updating student enrollment:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Student leaves class
 * POST /v1/enrollment/class/:classroomId/leave
 */
exports.leaveClass = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const userId = req.user._id;

    const classDoc = await Classroom.findOne({
      _id: classroomId,
      organization: organizationId,
    });
    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    const { seatRelease } = await Enrollment.leaveClassroom({
      classroomId,
      userId,
      organizationId,
      updatedBy: clerkUserId,
      allowAdminEnrollment: false,
    });

    res.json({
      success: true,
      message: "Left classroom successfully",
      data: {
        seatRelease: {
          action: seatRelease.action,
          claimId: seatRelease.claim?._id || null,
        },
      },
    });
  } catch (error) {
    console.error("Error leaving class:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Transfer student to another classroom within the organization (org:admin only).
 * POST /v1/enrollment/admin/transfer
 */
exports.transferStudent = async function (req, res) {
  try {
    const { userId, fromClassroomId, toClassroomId } = req.body || {};
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!userId || !fromClassroomId || !toClassroomId) {
      return res.status(400).json({
        error: "userId, fromClassroomId, and toClassroomId are required",
      });
    }

    const result = await Enrollment.transferStudentBetweenClassrooms({
      organizationId,
      fromClassroomId,
      toClassroomId,
      userId,
      performedByClerkUserId: clerkUserId,
    });

    res.json({
      success: true,
      message: "Student transferred successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error transferring student:", error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
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

  // Get classrooms where enrolled (admin access handled via Enrollment.role)
  const classrooms = await Classroom.find({
    organization: organizationId,
    _id: { $in: enrolledClassIds },
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
        isAdmin: enrollment?.role === "admin",
        isEnrolled: !!enrollment,
        enrollmentRole: enrollment?.role || null,
      },
    };
  });

  res.json({ success: true, data: enrichedClassrooms });
};

/**
 * Export class roster as CSV
 * POST /api/admin/class/:classroomId/roster/export
 */
exports.exportRoster = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Verify classroom exists and user has access
    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ error: "Class not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Process export to get CSV directly
    const result = await Enrollment.processRosterExport(
      classroomId,
      organizationId
    );

    // Set headers for CSV download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    // optional: helps with proxies/buffers
    res.setHeader("Content-Length", Buffer.byteLength(result.csv, "utf8"));

    return res.status(200).send(result.csv);
  } catch (error) {
    console.error("Error exporting roster:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "No students found in roster") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
};
