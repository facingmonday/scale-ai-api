const express = require("express");
const controller = require("./scenarioOutcome.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
} = require("../../middleware/auth");

// Admin routes - require org:admin role
router.post(
  "/admin/scenario/:scenarioId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.setScenarioOutcome
);

router.get(
  "/admin/scenario/:scenarioId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarioOutcome
);

router.post(
  "/admin/scenario/:scenarioId/outcome/approve",
  requireAuth(),
  checkRole("org:admin"),
  controller.approveScenarioOutcome
);

module.exports = router;

