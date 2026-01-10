const Store = require("./store.model");
const Enrollment = require("../enrollment/enrollment.model");
const Classroom = require("../classroom/classroom.model");

/**
 * Validate store request body and extract store data
 * @param {Object} body - Request body
 * @param {boolean} requireAllFields - Whether all fields are required (for create)
 * @returns {Object} { storeData, error }
 */
function validateStoreData(body, requireAllFields = false) {
  const {
    classroomId,
    shopName,
    storeDescription,
    storeLocation,
    storeType,
    variables,
    imageUrl,
  } = body;

  if (!classroomId) {
    return { error: "classroomId is required" };
  }

  if (requireAllFields) {
    if (!shopName) {
      return { error: "shopName is required" };
    }
    if (!storeDescription) {
      return { error: "storeDescription is required" };
    }
    if (!storeLocation) {
      return { error: "storeLocation is required" };
    }
    if (!storeType) {
      return { error: "storeType is required" };
    }
  }

  return {
    storeData: {
      shopName,
      storeDescription,
      storeLocation,
      storeType,
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
 * Create store (delegates to updateStore for upsert behavior)
 * POST /api/student/store
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

    // Create store (uses updateStore internally which now handles upsert)
    const store = await Store.createStore(
      classroomId,
      member._id,
      storeData,
      context.organizationId,
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Store created successfully",
      data: store,
    });
  } catch (error) {
    console.error("Error creating store:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update or create store (upsert)
 * PUT /api/student/store
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

    // Check if store exists to determine success message
    const existingStore = await Store.getStoreByUser(classroomId, member._id);
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

    // Update or create store using static method (upsert)
    const store = await Store.updateStore(
      classroomId,
      member._id,
      storeData,
      context.organizationId,
      clerkUserId
    );

    res.json({
      success: true,
      message: isCreating
        ? "Store created successfully"
        : "Store updated successfully",
      data: store,
    });
  } catch (error) {
    console.error("Error updating store:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get store for authenticated student
 * GET /api/student/store
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

    // Get store with current details using static method
    const store = await Store.getStoreByUser(classroomId, member._id);

    if (!store) {
      return res.status(200).json({ data: null });
    }

    res.json({
      success: true,
      data: store,
    });
  } catch (error) {
    console.error("Error getting store:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get student store (admin only)
 * GET /api/admin/class/:classroomId/store/:userId
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

    // Get store with current details using static method
    const store = await Store.getStoreByUser(classroomId, userId);

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    res.json({
      success: true,
      data: store,
    });
  } catch (error) {
    console.error("Error getting student store:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
