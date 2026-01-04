const VariableDefinition = require("./variableDefinition.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");

/**
 * Create variable definition
 * POST /api/admin/variables
 */
exports.createVariableDefinition = async function (req, res) {
  try {
    const {
      classroomId,
      key,
      label,
      description,
      appliesTo,
      dataType,
      inputType,
      options,
      defaultValue,
      min,
      max,
      required,
    } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }
    if (!label) {
      return res.status(400).json({ error: "label is required" });
    }
    if (!appliesTo) {
      return res.status(400).json({ error: "appliesTo is required" });
    }
    if (!dataType) {
      return res.status(400).json({ error: "dataType is required" });
    }
    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }

    // Validate appliesTo enum
    if (!["store", "scenario", "submission", "storeType"].includes(appliesTo)) {
      throw new Error(
        "appliesTo must be one of: store, scenario, submission, storeType"
      );
    }

    // Validate dataType enum
    if (!["number", "string", "boolean", "select"].includes(dataType)) {
      throw new Error(
        "dataType must be one of: number, string, boolean, select"
      );
    }

    // Verify admin access to class (all definitions are classroom-scoped)
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Create definition using static method
    const definition = await VariableDefinition.createDefinition(
      classroomId,
      {
        key,
        label,
        description,
        appliesTo,
        dataType,
        inputType,
        options,
        defaultValue,
        min,
        max,
        required,
      },
      organizationId,
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Variable definition created successfully",
      data: definition,
    });
  } catch (error) {
    console.error("Error creating variable definition:", error);
    if (
      error.message.includes("already exists") ||
      error.message.includes("Invalid inputType")
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update variable definition
 * PUT /api/admin/variables/:key
 */
exports.updateVariableDefinition = async function (req, res) {
  try {
    const { key } = req.params;
    const { classroomId } = req.query;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Find definition
    const definition = await VariableDefinition.getDefinitionByKey(
      classroomId,
      key
    );

    if (!definition) {
      return res.status(404).json({ error: "Variable definition not found" });
    }

    // Prevent changing appliesTo if definition is in use
    if (req.body.appliesTo && req.body.appliesTo !== definition.appliesTo) {
      const isInUse = await definition.isInUse();
      if (isInUse) {
        return res.status(400).json({
          error: "Cannot change appliesTo after variable is in use",
        });
      }
    }

    // Prevent changing key
    if (req.body.key && req.body.key !== definition.key) {
      return res.status(400).json({
        error: "Variable key cannot be changed",
      });
    }

    // Update allowed fields
    const allowedFields = [
      "label",
      "description",
      "appliesTo",
      "dataType",
      "inputType",
      "options",
      "defaultValue",
      "min",
      "max",
      "required",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        definition[field] = req.body[field];
      }
    });

    definition.updatedBy = clerkUserId;
    await definition.save();

    res.json({
      success: true,
      message: "Variable definition updated successfully",
      data: definition,
    });
  } catch (error) {
    console.error("Error updating variable definition:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get variable definitions
 * GET /api/admin/variables?classroomId=...&appliesTo=...
 */
exports.getVariableDefinitions = async function (req, res) {
  try {
    const { classroomId, appliesTo } = req.query;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    // Verify admin access or enrollment
    try {
      await Classroom.validateAdminAccess(
        classroomId,
        clerkUserId,
        organizationId
      );
    } catch (adminError) {
      // If not admin, check if enrolled
      const member = req.user;
      if (!member) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const isEnrolled = await Enrollment.isUserEnrolled(
        classroomId,
        member._id
      );
      if (!isEnrolled) {
        return res.status(403).json({
          error: "Not enrolled in this class",
        });
      }
    }

    const query = {
      organization: organizationId,
      classroomId,
    };
    if (appliesTo) {
      query.appliesTo = appliesTo;
    }
    const definitions = await VariableDefinition.find(query).sort({ label: 1 });

    res.json({
      success: true,
      data: definitions,
    });
  } catch (error) {
    console.error("Error getting variable definitions:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete variable definition (soft delete)
 * DELETE /api/admin/variables/:key
 */
exports.deleteVariableDefinition = async function (req, res) {
  try {
    const { key } = req.params;
    const { classroomId } = req.query;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Find definition
    const definition = await VariableDefinition.getDefinitionByKey(
      classroomId,
      key
    );

    if (!definition) {
      return res.status(404).json({ error: "Variable definition not found" });
    }

    // Check if in use (optional - can allow deletion anyway)
    const isInUse = await definition.isInUse();
    if (isInUse) {
      // Still allow soft delete, but warn
      console.warn(
        `Soft deleting variable definition "${key}" that may be in use`
      );
    }

    // Soft delete
    await definition.softDelete();

    res.json({
      success: true,
      message: "Variable definition deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting variable definition:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
