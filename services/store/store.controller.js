const Store = require("./store.model");
const Enrollment = require("../enrollment/enrollment.model");
const Classroom = require("../classroom/classroom.model");

/**
 * Create store
 * POST /api/student/store
 */
exports.createStore = async function (req, res) {
  try {
    const {
      classroomId,
      shopName,
      storeDescription,
      storeLocation,
      storeType,
      variables,
    } = req.body;
    const clerkUserId = req.clerkUser.id;

    // Validate required fields
    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }
    if (!shopName) {
      return res.status(400).json({ error: "shopName is required" });
    }
    if (!storeDescription) {
      return res.status(400).json({ error: "storeDescription is required" });
    }
    if (!storeLocation) {
      return res.status(400).json({ error: "storeLocation is required" });
    }
    if (!storeType) {
      return res.status(400).json({ error: "storeType is required" });
    }

    // Verify user is enrolled in class
    const member = req.user;
    const isEnrolled = await Enrollment.isUserEnrolled(classroomId, member._id);

    if (!isEnrolled) {
      return res.status(403).json({
        error: "User is not enrolled in this class",
      });
    }

    // Get organization from class
    const Classroom = require("../classroom/classroom.model");
    const classDoc = await Classroom.findById(classroomId);
    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    const organizationId = classDoc.organization;

    // Create store using static method
    const store = await Store.createStore(
      classroomId,
      member._id,
      {
        shopName,
        storeDescription,
        storeLocation,
        storeType,
        variables,
      },
      organizationId,
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Store created successfully",
      data: store,
    });
  } catch (error) {
    console.error("Error creating store:", error);
    if (error.message === "Store already exists for this user in this class") {
      return res.status(409).json({ error: error.message });
    }
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
    const {
      classroomId,
      shopName,
      storeDescription,
      storeLocation,
      storeType,
      variables,
    } = req.body;
    const member = req.user;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }

    // Validate required fields if creating new store
    const existingStore = await Store.getStoreByUser(classroomId, member._id);
    const isCreating = !existingStore;

    if (isCreating) {
      if (!shopName) {
        return res.status(400).json({ error: "shopName is required" });
      }
      if (!storeDescription) {
        return res.status(400).json({ error: "storeDescription is required" });
      }
      if (!storeLocation) {
        return res.status(400).json({ error: "storeLocation is required" });
      }
      if (!storeType) {
        return res
          .status(400)
          .json({ error: "storeType is required when creating a new store" });
      }
    }

    // Verify user is enrolled in class
    const isEnrolled = await Enrollment.isUserEnrolled(classroomId, member._id);

    if (!isEnrolled) {
      return res.status(403).json({
        error: "User is not enrolled in this class",
      });
    }

    // Get organization from class
    const classDoc = await Classroom.findById(classroomId);
    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    const organizationId = classDoc.organization;

    // Update or create store using static method (upsert)
    const store = await Store.updateStore(
      classroomId,
      member._id,
      {
        shopName,
        storeDescription,
        storeLocation,
        storeType,
        variables,
      },
      organizationId,
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
