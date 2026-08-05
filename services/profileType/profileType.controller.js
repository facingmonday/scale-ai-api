const ProfileType = require("./profileType.model");
const Classroom = require("../classroom/classroom.model");

/**
 * Create profile type
 * POST /api/admin/profile-types
 */
exports.createStoreType = async function (req, res) {
  try {
    const {
      key,
      label,
      description,
      startingBalance,
      initialStartupCost,
      variables,
      presetVariables,
    } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Get classroomId from the auth active classroom
    const classroomId = req?.activeClassroom?._id;

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

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Create profile type using static method
    const profileType = await ProfileType.createStoreType(
      classroomId,
      organizationId,
      {
        key,
        label,
        description,
        startingBalance,
        initialStartupCost,
        // Backward compat: accept presetVariables, but canonical field is variables
        variables: variables || presetVariables || {},
      },
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Profile type created successfully",
      data: profileType,
    });
  } catch (error) {
    console.error("Error creating profile type:", error);
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
 * Update profile type
 * PUT /api/admin/profile-types/:storeTypeId
 */
exports.updateStoreType = async function (req, res) {
  try {
    const { storeTypeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find profile type
    const profileType = await ProfileType.findOne({
      _id: storeTypeId,
      organization: organizationId,
      isActive: true,
    });

    if (!profileType) {
      return res.status(404).json({ error: "Profile type not found" });
    }

    await Classroom.validateAdminAccess(
      profileType.classroomId,
      clerkUserId,
      organizationId
    );

    // Prevent changing key
    if (req.body.key && req.body.key !== profileType.key) {
      return res.status(400).json({
        error: "Profile type key cannot be changed",
      });
    }

    // Update allowed fields
    const allowedFields = [
      "label",
      "description",
      "startingBalance",
      "initialStartupCost",
    ];

    // Handle variables separately
    if (req.body.variables !== undefined) {
      const VariableValue = require("../variableDefinition/variableValue.model");
      const variableEntries = Object.entries(req.body.variables);

      // Update or create variable values
      for (const [variableKey, value] of variableEntries) {
        await VariableValue.setVariable(
          profileType.classroomId,
          "profileType",
          profileType._id,
          variableKey,
          value,
          organizationId,
          clerkUserId
        );
      }

      // Delete variables that are not in the new set
      const existingVariables = await VariableValue.find({
        classroomId: profileType.classroomId,
        appliesTo: "profileType",
        ownerId: profileType._id,
      });
      const newKeys = new Set(Object.keys(req.body.variables));
      for (const existingVar of existingVariables) {
        if (!newKeys.has(existingVar.variableKey)) {
          await VariableValue.deleteOne({ _id: existingVar._id });
        }
      }

      // Reload variables
      await profileType._loadVariables();
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        profileType[field] = req.body[field];
      }
    });

    profileType.updatedBy = clerkUserId;
    await profileType.save();

    res.json({
      success: true,
      message: "Profile type updated successfully",
      data: profileType,
    });
  } catch (error) {
    console.error("Error updating profile type:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get profile types for organization
 * GET /api/admin/profile-types
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

    const profileTypes = await ProfileType.getStoreTypesByClassroom(
      classroomId,
      organizationId,
      {
        includeInactive: includeInactive === "true",
      }
    );

    res.json({
      success: true,
      data: profileTypes,
    });
  } catch (error) {
    console.error("Error getting profile types:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get profile type by ID
 * GET /api/admin/profile-types/:storeTypeId
 */
exports.getStoreType = async function (req, res) {
  try {
    const { storeTypeId } = req.params;
    const organizationId = req.organization._id;

    const storeTypeDoc = await ProfileType.findOne({
      _id: storeTypeId,
      organization: organizationId,
      isActive: true,
    });

    if (!storeTypeDoc) {
      return res.status(404).json({ error: "Profile type not found" });
    }

    await Classroom.validateAdminAccess(
      storeTypeDoc.classroomId,
      req.clerkUser.id,
      organizationId
    );

    // Load variables before returning
    await storeTypeDoc._loadVariables();
    const profileType = storeTypeDoc.toObject();

    res.json({
      success: true,
      data: profileType,
    });
  } catch (error) {
    console.error("Error getting profile type:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete profile type (soft delete)
 * DELETE /api/admin/profile-types/:storeTypeId
 */
exports.deleteStoreType = async function (req, res) {
  try {
    const { storeTypeId } = req.params;
    const organizationId = req.organization._id;

    const profileType = await ProfileType.findOne({
      _id: storeTypeId,
      organization: organizationId,
      isActive: true,
    });

    if (!profileType) {
      return res.status(404).json({ error: "Profile type not found" });
    }

    await Classroom.validateAdminAccess(
      profileType.classroomId,
      req.clerkUser.id,
      organizationId
    );

    // Soft delete
    await profileType.softDelete();

    res.json({
      success: true,
      message: "Profile type deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting profile type:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get profile types for students
 * GET /api/student/profile-types
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

    await Classroom.validateStudentAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get only active profile types (students shouldn't see inactive ones),
    // with variables populated.
    const profileTypes = await ProfileType.getStoreTypesByClassroom(
      classroomId,
      organizationId
    );

    res.json({
      success: true,
      data: profileTypes,
    });
  } catch (error) {
    console.error("Error getting profile types for student:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Seed default profile types for organization
 * POST /api/admin/profile-types/seed
 */
exports.seedDefaultStoreTypes = async function (req, res) {
  try {
    // profileTypePresets-based seeding is deprecated; profile types should be created via API/UI.
    res.status(410).json({
      success: false,
      error:
        "ProfileType preset seeding is no longer supported. Create ProfileTypes and their variables via the ProfileType API instead.",
    });
  } catch (error) {
    console.error("Error seeding profile types:", error);
    res.status(500).json({ error: error.message });
  }
};
