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

/** Get scenario by id */
router.get(
  "/admin/scenarios/:id",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarioById
);

// Admin routes - require org:admin role
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
