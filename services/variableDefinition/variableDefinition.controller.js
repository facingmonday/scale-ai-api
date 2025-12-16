const VariableDefinition = require("./variableDefinition.model");
const Classroom = require("../classroom/classroom.model");
const classroomService = require("../classroom/lib/classroomService");
const enrollmentService = require("../enrollment/lib/enrollmentService");

/**
 * Create variable definition
 * POST /api/admin/variables
 */
exports.createVariableDefinition = async function (req, res) {
  try {
    const {
      classId,
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
      affectsCalculation,
    } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Validate required fields
    if (!classId) {
      return res.status(400).json({ error: "classId is required" });
    }
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

    // Validate appliesTo enum
    if (!["store", "scenario", "submission"].includes(appliesTo)) {
      return res.status(400).json({
        error: "appliesTo must be one of: store, scenario, submission",
      });
    }

    // Validate dataType enum
    if (!["number", "string", "boolean", "select"].includes(dataType)) {
      return res.status(400).json({
        error: "dataType must be one of: number, string, boolean, select",
      });
    }

    // Verify admin access to class
    await classroomService.validateAdminAccess(
      classId,
      clerkUserId,
      organizationId
    );

    // Create definition using static method
    const definition = await VariableDefinition.createDefinition(
      classId,
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
        affectsCalculation,
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
    const { classId } = req.query;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classId) {
      return res.status(400).json({ error: "classId query parameter is required" });
    }

    // Verify admin access
    await classroomService.validateAdminAccess(
      classId,
      clerkUserId,
      organizationId
    );

    // Find definition
    const definition = await VariableDefinition.getDefinitionByKey(classId, key);

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
      "affectsCalculation",
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
 * GET /api/admin/variables?classId=...&appliesTo=...
 */
exports.getVariableDefinitions = async function (req, res) {
  try {
    const { classId, appliesTo } = req.query;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classId) {
      return res.status(400).json({ error: "classId query parameter is required" });
    }

    // Verify admin access or enrollment
    try {
      await classroomService.validateAdminAccess(
        classId,
        clerkUserId,
        organizationId
      );
    } catch (adminError) {
      // If not admin, check if enrolled
      const member = req.user;
      if (!member) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const isEnrolled = await enrollmentService.isUserEnrolled(
        classId,
        member._id
      );
      if (!isEnrolled) {
        return res.status(403).json({
          error: "Not enrolled in this class",
        });
      }
    }

    let definitions;

    if (appliesTo) {
      // Get definitions for specific scope
      definitions = await VariableDefinition.getDefinitionsForScope(
        classId,
        appliesTo
      );
    } else {
      // Get all definitions for class
      definitions = await VariableDefinition.getDefinitionsByClass(classId);
    }

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
    const { classId } = req.query;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classId) {
      return res.status(400).json({ error: "classId query parameter is required" });
    }

    // Verify admin access
    await classroomService.validateAdminAccess(
      classId,
      clerkUserId,
      organizationId
    );

    // Find definition
    const definition = await VariableDefinition.getDefinitionByKey(classId, key);

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

