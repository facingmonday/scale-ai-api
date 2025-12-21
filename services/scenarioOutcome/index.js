const express = require("express");
const controller = require("./scenarioOutcome.controller");
const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

// Admin routes - require org:admin role
router.post(
  "/admin/scenarioOutcomes/:scenarioId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.setScenarioOutcome
);

router.get(
  "/admin/scenarioOutcomes/:scenarioId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarioOutcome
);

// Delete scenario outcome
router.delete(
  "/admin/scenarioOutcomes/:scenarioId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteScenarioOutcome
);

// Student routes
router.get(
  "/student/scenarioOutcomes/:scenarioId/outcome",
  requireAuth(),
  checkRole("org:member"),
  controller.getScenarioOutcome
);

module.exports = router;
