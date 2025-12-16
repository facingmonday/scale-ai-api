const express = require("express");
const controller = require("./scenario.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Admin routes - require org:admin role
router.post(
  "/admin/scenario",
  requireAuth(),
  checkRole("org:admin"),
  controller.createScenario
);

router.put(
  "/admin/scenario/:scenarioId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateScenario
);

router.post(
  "/admin/scenario/:scenarioId/publish",
  requireAuth(),
  checkRole("org:admin"),
  controller.publishScenario
);

router.post(
  "/admin/scenario/:scenarioId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.setScenarioOutcome
);

router.post(
  "/admin/scenario/:scenarioId/preview",
  requireAuth(),
  checkRole("org:admin"),
  controller.previewScenario
);

router.post(
  "/admin/scenario/:scenarioId/approve",
  requireAuth(),
  checkRole("org:admin"),
  controller.approveScenario
);

router.post(
  "/admin/scenario/:scenarioId/rerun",
  requireAuth(),
  checkRole("org:admin"),
  controller.rerunScenario
);

// Student routes - require authenticated member
router.get(
  "/student/scenario/current",
  requireMemberAuth(),
  controller.getCurrentScenario
);

module.exports = router;

