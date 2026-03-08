/**
 * SimulationOutputDefinition Service Routes
 *
 * CRUD for classroom-scoped simulation output definitions.
 * These define what metrics/fields the AI simulation returns.
 * Mounted at: /v1/admin/class/:classroomId/simulation-output-definitions
 * Schema endpoint: /v1/admin/class/:classroomId/simulation-output-schema
 */
const express = require("express");
const controller = require("./simulationOutputDefinition.controller");
const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

router.get(
  "/admin/class/:classroomId/simulation-output-definitions",
  requireAuth(),
  controller.listDefinitions
);

router.post(
  "/admin/class/:classroomId/simulation-output-definitions",
  requireAuth(),
  checkRole("org:admin"),
  controller.createDefinition
);

router.put(
  "/admin/class/:classroomId/simulation-output-definitions/:definitionId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateDefinition
);

router.delete(
  "/admin/class/:classroomId/simulation-output-definitions/:definitionId",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteDefinition
);

router.get(
  "/admin/class/:classroomId/simulation-output-schema",
  requireAuth(),
  controller.getSchema
);

module.exports = router;
