const Profile = require("./profile.model");
const Enrollment = require("../enrollment/enrollment.model");
const Classroom = require("../classroom/classroom.model");

/**
 * Validate profile request body and extract profile data
 * @param {Object} body - Request body
 * @param {boolean} requireAllFields - Whether all fields are required (for create)
 * @returns {Object} { storeData, error }
 */
function validateStoreData(body, requireAllFields = false) {
  const {
    classroomId,
    studentId,
    shopName,
    storeDescription,
    storeLocation,
    profileType,
    variables,
    imageUrl,
  } = body;

  if (!classroomId) {
    return { error: "classroomId is required" };
  }

  if (requireAllFields) {
    if (!studentId) {
      return { error: "studentId is required" };
    }
    if (!shopName) {
      return { error: "shopName is required" };
    }
    if (!storeDescription) {
      return { error: "storeDescription is required" };
    }
    if (!storeLocation) {
      return { error: "storeLocation is required" };
    }
    if (!profileType) {
      return { error: "profileType is required" };
    }
  }

  return {
    storeData: {
      studentId,
      shopName,
      storeDescription,
      storeLocation,
      profileType,
      variables,
      imageUrl,
    },
  };
}

/**
 * Verify enrollment and get classroom/organization context
 * @param {string} classroomId - Class ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { classroom, organizationId, error }
 */
async function verifyEnrollmentAndGetContext(classroomId, userId) {
  // Verify user is enrolled in class
  const isEnrolled = await Enrollment.isUserEnrolled(classroomId, userId);

  if (!isEnrolled) {
    return { error: "User is not enrolled in this class" };
  }

  // Get organization from class
  const classDoc = await Classroom.findById(classroomId);
  if (!classDoc) {
    return { error: "Class not found" };
  }

  return {
    classroom: classDoc,
    organizationId: classDoc.organization,
  };
}

/**
 * Create profile (delegates to updateStore for upsert behavior)
 * POST /api/student/profile
 */
exports.createStore = async function (req, res) {
  try {
    const clerkUserId = req.clerkUser.id;
    const member = req.user;

    // Validate required fields (all fields required for create)
    const validation = validateStoreData(req.body, true);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { storeData } = validation;
    const { classroomId } = req.body;

    // Verify enrollment and get context
    const context = await verifyEnrollmentAndGetContext(
      classroomId,
      member._id
    );
    if (context.error) {
      return res
        .status(context.error.includes("not enrolled") ? 403 : 404)
        .json({
          error: context.error,
        });
    }

    // Create profile (uses updateStore internally which now handles upsert)
    const profile = await Profile.createStore(
      classroomId,
      member._id,
      storeData,
      context.organizationId,
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Profile created successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Error creating profile:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update or create profile (upsert)
 * PUT /api/student/profile
 */
exports.updateStore = async function (req, res) {
  try {
    const clerkUserId = req.clerkUser.id;
    const member = req.user;

    // Validate required fields (only classroomId required for update)
    const validation = validateStoreData(req.body, false);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { storeData } = validation;
    const { classroomId } = req.body;

    // Check if profile exists to determine success message
    const existingStore = await Profile.getStoreByUser(classroomId, member._id);
    const isCreating = !existingStore;

    // Verify enrollment and get context
    const context = await verifyEnrollmentAndGetContext(
      classroomId,
      member._id
    );
    if (context.error) {
      return res
        .status(context.error.includes("not enrolled") ? 403 : 404)
        .json({
          error: context.error,
        });
    }

    // Update or create profile using static method (upsert)
    const profile = await Profile.updateStore(
      classroomId,
      member._id,
      storeData,
      context.organizationId,
      clerkUserId
    );

    res.json({
      success: true,
      message: isCreating
        ? "Profile created successfully"
        : "Profile updated successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get profile for authenticated student
 * GET /api/student/profile
 */
exports.getStore = async function (req, res) {
  try {
    const { classroomId } = req.query;
    const member = req.user;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    // Get profile with current details using static method
    const profile = await Profile.getStoreByUser(classroomId, member._id);

    if (!profile) {
      return res.status(200).json({ data: null });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get student profile (admin only)
 * GET /api/admin/class/:classroomId/profile/:userId
 */
exports.getStudentStore = async function (req, res) {
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

    // Get profile with current details using static method
    const profile = await Profile.getStoreByUser(classroomId, userId);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Error getting student profile:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
