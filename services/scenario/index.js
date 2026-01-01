/**
 * Scenario Service Routes
 *
 * Provides endpoints for managing scenarios (weekly simulation contexts).
 * Includes admin routes (creating, publishing, managing scenarios) and student routes (viewing scenarios).
 * Mounted at: /v1/admin/scenarios and /v1/student/scenarios
 */
const express = require("express");
const controller = require("./scenario.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Admin routes - require org:admin role
// Put specific routes before parameterized routes
router.post(
  "/admin/scenarios",
  requireAuth(),
  checkRole("org:admin"),
  controller.createScenario
);

router.put(
  "/admin/scenarios/:scenarioId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateScenario
);

router.post(
  "/admin/scenarios/:scenarioId/publish",
  requireAuth(),
  checkRole("org:admin"),
  controller.publishScenario
);

router.post(
  "/admin/scenarios/:scenarioId/unpublish",
  requireAuth(),
  checkRole("org:admin"),
  controller.unpublishScenario
);

router.post(
  "/admin/scenarios/:scenarioId/preview",
  requireAuth(),
  checkRole("org:admin"),
  controller.previewScenario
);

router.post(
  "/admin/scenarios/:scenarioId/rerun",
  requireAuth(),
  checkRole("org:admin"),
  controller.rerunScenario
);

router.post(
  "/admin/scenarios/:scenarioId/export",
  requireAuth(),
  checkRole("org:admin"),
  controller.exportScenario
);

router.get(
  "/admin/scenarios",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarios
);

router.get(
  "/admin/scenarios/current",
  requireAuth(),
  checkRole("org:admin"),
  controller.getCurrentScenarioForAdmin
);

/** Get scenario by id - must come after specific routes */
router.get(
  "/admin/scenarios/:id",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarioById
);

router.delete(
  "/admin/scenarios/:scenarioId",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteScenario
);

// Student routes - require authenticated member

router.get(
  "/student/scenarios/current",
  requireMemberAuth(),
  controller.getCurrentScenario
);
router.get(
  "/student/scenarios/:id",
  requireMemberAuth(),
  controller.getScenarioByIdForStudent
);

router.get(
  "/student/scenarios",
  requireMemberAuth(),
  controller.getStudentScenariosByClassroom
);

module.exports = router;
