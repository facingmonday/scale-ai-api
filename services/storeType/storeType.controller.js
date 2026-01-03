const StoreType = require("./storeType.model");
const Classroom = require("../classroom/classroom.model");

/**
 * Create store type
 * POST /api/admin/store-types
 */
exports.createStoreType = async function (req, res) {
  try {
    const { classroomId, key, label, description, variables, presetVariables } =
      req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }

    // Validate required fields
    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }
    if (!label) {
      return res.status(400).json({ error: "label is required" });
    }

    await Classroom.validateAdminAccess(classroomId, clerkUserId, organizationId);

    // Create store type using static method
    const storeType = await StoreType.createStoreType(
      classroomId,
      organizationId,
      {
        key,
        label,
        description,
        // Backward compat: accept presetVariables, but canonical field is variables
        variables: variables || presetVariables || {},
      },
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Store type created successfully",
      data: storeType,
    });
  } catch (error) {
    console.error("Error creating store type:", error);
    if (error.message.includes("already exists")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update store type
 * PUT /api/admin/store-types/:storeTypeId
 */
exports.updateStoreType = async function (req, res) {
  try {
    const { storeTypeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find store type
    const storeType = await StoreType.findOne({
      _id: storeTypeId,
      organization: organizationId,
      isActive: true,
    });

    if (!storeType) {
      return res.status(404).json({ error: "Store type not found" });
    }

    await Classroom.validateAdminAccess(
      storeType.classroomId,
      clerkUserId,
      organizationId
    );

    // Prevent changing key
    if (req.body.key && req.body.key !== storeType.key) {
      return res.status(400).json({
        error: "Store type key cannot be changed",
      });
    }

    // Update allowed fields
    const allowedFields = ["label", "description"];

    // Handle variables separately
    if (req.body.variables !== undefined) {
      const VariableValue = require("../variableDefinition/variableValue.model");
      const variableEntries = Object.entries(req.body.variables);

      // Update or create variable values
      for (const [variableKey, value] of variableEntries) {
        await VariableValue.setVariable(
          storeType.classroomId,
          "storeType",
          storeType._id,
          variableKey,
          value,
          organizationId,
          clerkUserId
        );
      }

      // Delete variables that are not in the new set
      const existingVariables = await VariableValue.find({
        classroomId: storeType.classroomId,
        appliesTo: "storeType",
        ownerId: storeType._id,
      });
      const newKeys = new Set(Object.keys(req.body.variables));
      for (const existingVar of existingVariables) {
        if (!newKeys.has(existingVar.variableKey)) {
          await VariableValue.deleteOne({ _id: existingVar._id });
        }
      }

      // Reload variables
      await storeType._loadVariables();
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        storeType[field] = req.body[field];
      }
    });

    storeType.updatedBy = clerkUserId;
    await storeType.save();

    res.json({
      success: true,
      message: "Store type updated successfully",
      data: storeType,
    });
  } catch (error) {
    console.error("Error updating store type:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get store types for organization
 * GET /api/admin/store-types
 */
exports.getStoreTypes = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const { classroomId, includeInactive } = req.query;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    await Classroom.validateAdminAccess(
      classroomId,
      req.clerkUser.id,
      organizationId
    );

    const storeTypes = await StoreType.getStoreTypesByClassroom(
      classroomId,
      organizationId,
      {
        includeInactive: includeInactive === "true",
      }
    );

    res.json({
      success: true,
      data: storeTypes,
    });
  } catch (error) {
    console.error("Error getting store types:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get store type by ID
 * GET /api/admin/store-types/:storeTypeId
 */
exports.getStoreType = async function (req, res) {
  try {
    const { storeTypeId } = req.params;
    const organizationId = req.organization._id;

    const storeTypeDoc = await StoreType.findOne({
      _id: storeTypeId,
      organization: organizationId,
      isActive: true,
    });

    if (!storeTypeDoc) {
      return res.status(404).json({ error: "Store type not found" });
    }

    await Classroom.validateAdminAccess(
      storeTypeDoc.classroomId,
      req.clerkUser.id,
      organizationId
    );

    // Load variables before returning
    await storeTypeDoc._loadVariables();
    const storeType = storeTypeDoc.toObject();

    res.json({
      success: true,
      data: storeType,
    });
  } catch (error) {
    console.error("Error getting store type:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete store type (soft delete)
 * DELETE /api/admin/store-types/:storeTypeId
 */
exports.deleteStoreType = async function (req, res) {
  try {
    const { storeTypeId } = req.params;
    const organizationId = req.organization._id;

    const storeType = await StoreType.findOne({
      _id: storeTypeId,
      organization: organizationId,
      isActive: true,
    });

    if (!storeType) {
      return res.status(404).json({ error: "Store type not found" });
    }

    await Classroom.validateAdminAccess(
      storeType.classroomId,
      req.clerkUser.id,
      organizationId
    );

    // Soft delete
    await storeType.softDelete();

    res.json({
      success: true,
      message: "Store type deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting store type:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get store types for students
 * GET /api/student/store-types
 */
exports.getStoreTypesForStudent = async function (req, res) {
  try {
    const organizationId = req.organization?._id || req.organization;
    const { classroomId } = req.query;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    await Classroom.validateStudentAccess(classroomId, clerkUserId, organizationId);

    // Get only active store types (students shouldn't see inactive ones),
    // with variables populated.
    const storeTypes = await StoreType.getStoreTypesByClassroom(
      classroomId,
      organizationId
    );

    res.json({
      success: true,
      data: storeTypes,
    });
  } catch (error) {
    console.error("Error getting store types for student:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Seed default store types for organization
 * POST /api/admin/store-types/seed
 */
exports.seedDefaultStoreTypes = async function (req, res) {
  try {
    // storeTypePresets-based seeding is deprecated; store types should be created via API/UI.
    res.status(410).json({
      success: false,
      error:
        "StoreType preset seeding is no longer supported. Create StoreTypes and their variables via the StoreType API instead.",
    });
  } catch (error) {
    console.error("Error seeding store types:", error);
    res.status(500).json({ error: error.message });
  }
};
