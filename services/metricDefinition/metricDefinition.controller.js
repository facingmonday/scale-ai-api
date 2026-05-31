const MetricDefinition = require("./metricDefinition.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");

/**
 * Create metric definition
 * POST /api/admin/metrics
 */
exports.createMetricDefinition = async function (req, res) {
  try {
    const {
      classroomId,
      key,
      label,
      description,
      dataType,
      format,
      aiPromptRule,
      aggregation,
      displayIn,
      defaultInitialValue,
      sortOrder,
    } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }
    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }
    if (!label) {
      return res.status(400).json({ error: "label is required" });
    }
    if (!dataType) {
      return res.status(400).json({ error: "dataType is required" });
    }
    if (!["number", "string", "boolean"].includes(dataType)) {
      return res.status(400).json({
        error: "dataType must be one of: number, string, boolean",
      });
    }

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const definition = await MetricDefinition.createDefinition(
      classroomId,
      {
        key,
        label,
        description,
        dataType,
        format,
        aiPromptRule,
        aggregation,
        displayIn,
        defaultInitialValue,
        sortOrder,
      },
      organizationId,
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Metric definition created successfully",
      data: definition,
    });
  } catch (error) {
    console.error("Error creating metric definition:", error);
    if (error.message.includes("already exists")) {
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
 * Update metric definition
 * PUT /api/admin/metrics/:key?classroomId=...
 */
exports.updateMetricDefinition = async function (req, res) {
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

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const definition = await MetricDefinition.getDefinitionByKey(
      classroomId,
      key
    );

    if (!definition) {
      return res.status(404).json({ error: "Metric definition not found" });
    }

    if (req.body.key && req.body.key !== definition.key) {
      return res.status(400).json({
        error: "Metric key cannot be changed",
      });
    }

    const allowedFields = [
      "label",
      "description",
      "dataType",
      "format",
      "aiPromptRule",
      "aggregation",
      "displayIn",
      "defaultInitialValue",
      "sortOrder",
      "isActive",
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
      message: "Metric definition updated successfully",
      data: definition,
    });
  } catch (error) {
    console.error("Error updating metric definition:", error);
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
 * Get metric definitions
 * GET /api/admin/metrics?classroomId=...
 */
exports.getMetricDefinitions = async function (req, res) {
  try {
    const { classroomId, includeInactive } = req.query;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    try {
      await Classroom.validateAdminAccess(
        classroomId,
        clerkUserId,
        organizationId
      );
    } catch (adminError) {
      const member = req.user;
      if (!member) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const isEnrolled = await Enrollment.isUserEnrolled(
        classroomId,
        member._id
      );
      if (!isEnrolled) {
        return res
          .status(403)
          .json({ error: "Not enrolled in this class" });
      }
    }

    const definitions = await MetricDefinition.getDefinitionsForClassroom(
      classroomId,
      { includeInactive: includeInactive === "true" }
    );

    res.json({ success: true, data: definitions });
  } catch (error) {
    console.error("Error getting metric definitions:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete metric definition (soft delete)
 * DELETE /api/admin/metrics/:key?classroomId=...
 */
exports.deleteMetricDefinition = async function (req, res) {
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

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const definition = await MetricDefinition.getDefinitionByKey(
      classroomId,
      key
    );

    if (!definition) {
      return res.status(404).json({ error: "Metric definition not found" });
    }

    await definition.softDelete();

    res.json({
      success: true,
      message: "Metric definition deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting metric definition:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
