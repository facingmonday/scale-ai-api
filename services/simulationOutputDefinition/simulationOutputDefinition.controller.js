const SimulationOutputDefinition = require("./simulationOutputDefinition.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");

/**
 * List simulation output definitions for a classroom
 * GET /api/admin/class/:classroomId/simulation-output-definitions
 */
exports.listDefinitions = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const { includeInactive } = req.query;

    // Allow admin or enrolled member
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
        return res.status(403).json({ error: "Not enrolled in this class" });
      }
    }

    const definitions =
      await SimulationOutputDefinition.getDefinitionsForClassroom(classroomId, {
        includeInactive: includeInactive === "true",
      });

    res.json({ success: true, data: definitions });
  } catch (error) {
    console.error("Error listing simulation output definitions:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create a simulation output definition
 * POST /api/admin/class/:classroomId/simulation-output-definitions
 */
exports.createDefinition = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const { key, label, description, dataType, required, group, schemaHint, displayOrder } =
      req.body;

    if (!key) return res.status(400).json({ error: "key is required" });
    if (!label) return res.status(400).json({ error: "label is required" });
    if (!dataType)
      return res.status(400).json({ error: "dataType is required" });

    if (!["number", "string", "object", "array"].includes(dataType)) {
      return res.status(400).json({
        error: "dataType must be one of: number, string, object, array",
      });
    }

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const definition = await SimulationOutputDefinition.createDefinition(
      classroomId,
      { key, label, description, dataType, required, group, schemaHint, displayOrder },
      organizationId,
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Simulation output definition created",
      data: definition,
    });
  } catch (error) {
    console.error("Error creating simulation output definition:", error);
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
 * Update a simulation output definition
 * PUT /api/admin/class/:classroomId/simulation-output-definitions/:definitionId
 */
exports.updateDefinition = async function (req, res) {
  try {
    const { classroomId, definitionId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const definition = await SimulationOutputDefinition.findOne({
      _id: definitionId,
      classroomId,
      organization: organizationId,
    });

    if (!definition) {
      return res
        .status(404)
        .json({ error: "Simulation output definition not found" });
    }

    if (req.body.key && req.body.key !== definition.key) {
      return res.status(400).json({ error: "key cannot be changed" });
    }

    const allowedFields = [
      "label",
      "description",
      "dataType",
      "required",
      "group",
      "schemaHint",
      "displayOrder",
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
      message: "Simulation output definition updated",
      data: definition,
    });
  } catch (error) {
    console.error("Error updating simulation output definition:", error);
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
 * Soft-delete a simulation output definition
 * DELETE /api/admin/class/:classroomId/simulation-output-definitions/:definitionId
 */
exports.deleteDefinition = async function (req, res) {
  try {
    const { classroomId, definitionId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const definition = await SimulationOutputDefinition.findOne({
      _id: definitionId,
      classroomId,
      organization: organizationId,
    });

    if (!definition) {
      return res
        .status(404)
        .json({ error: "Simulation output definition not found" });
    }

    await definition.softDelete();

    res.json({
      success: true,
      message: "Simulation output definition deleted",
    });
  } catch (error) {
    console.error("Error deleting simulation output definition:", error);
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
 * Get the dynamic simulation output schema for a classroom.
 * Returns the definitions and the built JSON schema for the frontend.
 * GET /api/admin/class/:classroomId/simulation-output-schema
 */
exports.getSchema = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Allow admin or enrolled member
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
        return res.status(403).json({ error: "Not enrolled in this class" });
      }
    }

    const LedgerEntry = require("../ledger/ledger.model");
    const schema =
      await LedgerEntry.getAISimulationResponseJsonSchema(classroomId);

    const definitions =
      await SimulationOutputDefinition.getDefinitionsForClassroom(classroomId);

    res.json({
      success: true,
      data: {
        schema,
        definitions: definitions.map((d) => ({
          _id: d._id,
          key: d.key,
          label: d.label,
          description: d.description,
          dataType: d.dataType,
          required: d.required,
          group: d.group,
          schemaHint: d.schemaHint,
          displayOrder: d.displayOrder,
          isActive: d.isActive,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting simulation output schema:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
