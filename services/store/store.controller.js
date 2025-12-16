const Store = require("./store.model");
const Enrollment = require("../enrollment/enrollment.model");
const enrollmentService = require("../enrollment/lib/enrollmentService");
const classroomService = require("../classroom/lib/classroomService");

/**
 * Create store
 * POST /api/student/store
 */
exports.createStore = async function (req, res) {
  try {
    const {
      classId,
      shopName,
      storeType,
      dailyCapacity,
      deliveryRatio,
      startingBalance,
      variables,
    } = req.body;
    const clerkUserId = req.clerkUser.id;

    // Validate required fields
    if (!classId) {
      return res.status(400).json({ error: "classId is required" });
    }
    if (!shopName) {
      return res.status(400).json({ error: "shopName is required" });
    }
    if (!storeType) {
      return res.status(400).json({ error: "storeType is required" });
    }
    if (dailyCapacity === undefined || dailyCapacity === null) {
      return res.status(400).json({ error: "dailyCapacity is required" });
    }
    if (deliveryRatio === undefined || deliveryRatio === null) {
      return res.status(400).json({ error: "deliveryRatio is required" });
    }

    // Validate storeType enum
    if (!["indoor", "outdoor", "food_truck"].includes(storeType)) {
      return res.status(400).json({
        error: "storeType must be one of: indoor, outdoor, food_truck",
      });
    }

    // Validate deliveryRatio range
    if (deliveryRatio < 0 || deliveryRatio > 1) {
      return res.status(400).json({
        error: "deliveryRatio must be between 0 and 1",
      });
    }

    // Verify user is enrolled in class
    const member = req.user;
    const isEnrolled = await enrollmentService.isUserEnrolled(
      classId,
      member._id
    );

    if (!isEnrolled) {
      return res.status(403).json({
        error: "User is not enrolled in this class",
      });
    }

    // Get organization from class
    const Classroom = require("../classroom/classroom.model");
    const classDoc = await Classroom.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    const organizationId = classDoc.organization;

    // Create store using static method
    const store = await Store.createStore(
      classId,
      member._id,
      {
        shopName,
        storeType,
        dailyCapacity,
        deliveryRatio,
        startingBalance,
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
 * Get store for authenticated student
 * GET /api/student/store
 */
exports.getStore = async function (req, res) {
  try {
    const { classId } = req.query;
    const member = req.user;

    if (!classId) {
      return res.status(400).json({ error: "classId query parameter is required" });
    }

    // Get store using static method
    const store = await Store.getStoreByUser(classId, member._id);

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
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
 * GET /api/admin/class/:classId/store/:userId
 */
exports.getStudentStore = async function (req, res) {
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

    // Get store using static method
    const store = await Store.getStoreByUser(classId, userId);

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

