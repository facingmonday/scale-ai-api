/**
 * Challenge Service Routes
 *
 * Provides endpoints for managing challenges (weekly simulation contexts).
 * Includes admin routes (creating, publishing, managing challenges) and student routes (viewing challenges).
 * Mounted at: /v1/admin/challenges and /v1/student/challenges
 */
const express = require("express");
const controller = require("./challenge.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Admin routes - require org:admin role
// Put specific routes before parameterized routes
router.post(
  "/admin/challenges",
  requireAuth(),
  checkRole("org:admin"),
  controller.createScenario
);

router.put(
  "/admin/challenges/:challengeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateScenario
);

router.post(
  "/admin/challenges/:challengeId/publish",
  requireAuth(),
  checkRole("org:admin"),
  controller.publishScenario
);

router.post(
  "/admin/challenges/:challengeId/unpublish",
  requireAuth(),
  checkRole("org:admin"),
  controller.unpublishScenario
);

router.post(
  "/admin/challenges/:challengeId/preview",
  requireAuth(),
  checkRole("org:admin"),
  controller.previewScenario
);

router.post(
  "/admin/challenges/:challengeId/rerun",
  requireAuth(),
  checkRole("org:admin"),
  controller.rerunScenario
);

router.post(
  "/admin/challenges/:challengeId/cancel-batch-and-rerun",
  requireAuth(),
  checkRole("org:admin"),
  controller.cancelBatchAndRerunScenario
);

router.post(
  "/admin/challenges/:challengeId/export",
  requireAuth(),
  checkRole("org:admin"),
  controller.exportScenario
);

router.get(
  "/admin/challenges",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarios
);

router.get(
  "/admin/challenges/current",
  requireAuth(),
  checkRole("org:admin"),
  controller.getCurrentScenarioForAdmin
);

/** Get challenge by id - must come after specific routes */
router.get(
  "/admin/challenges/:id",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarioById
);

router.delete(
  "/admin/challenges/:challengeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteScenario
);

// Student routes - require authenticated member

router.get(
  "/student/challenges/current",
  requireMemberAuth(),
  controller.getCurrentScenario
);
router.get(
  "/student/challenges/:id",
  requireMemberAuth(),
  controller.getScenarioByIdForStudent
);

router.get(
  "/student/challenges",
  requireMemberAuth(),
  controller.getStudentScenariosByClassroom
);

module.exports = router;
