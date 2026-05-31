/**
 * Outcome Service Routes
 * 
 * Provides endpoints for managing challenge outcomes (global results that affect all students).
 * Includes admin routes (setting outcomes) and student routes (viewing outcomes after results are published).
 * Mounted at: /v1/admin/outcomes and /v1/student/outcomes
 */
const express = require("express");
const controller = require("./outcome.controller");
const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

// Admin routes - require org:admin role
router.post(
  "/admin/outcomes/:challengeId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.setScenarioOutcome
);

router.post(
  "/admin/outcomes/:challengeId/outcome/draft",
  requireAuth(),
  checkRole("org:admin"),
  controller.saveScenarioOutcomeDraft
);

router.post(
  "/admin/outcomes/:challengeId/outcome/approve",
  requireAuth(),
  checkRole("org:admin"),
  controller.approveScenarioOutcome
);

router.get(
  "/admin/outcomes/:challengeId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarioOutcome
);

// Update outcome variables (dynamic variable values for "outcome" scope)
router.put(
  "/admin/outcomes/:challengeId/outcome/variables",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateScenarioOutcomeVariables
);

// Delete challenge outcome
router.delete(
  "/admin/outcomes/:challengeId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteScenarioOutcome
);

// Student routes
router.get(
  "/student/outcomes/:challengeId/outcome",
  requireAuth(),
  checkRole("org:member"),
  controller.getScenarioOutcome
);

module.exports = router;
