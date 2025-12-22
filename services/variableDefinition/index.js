/**
 * VariableDefinition Service Routes
 * 
 * Provides endpoints for managing dynamic variable definitions.
 * Variables define the structure of questions/inputs for stores, scenarios, submissions, and outcomes.
 * Admin routes require org:admin role.
 * Mounted at: /v1/admin/variables
 */
const express = require("express");
const controller = require("./variableDefinition.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Admin routes - require org:admin role
router.post(
  "/admin/variables",
  requireAuth(),
  checkRole("org:admin"),
  controller.createVariableDefinition
);

router.put(
  "/admin/variables/:key",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateVariableDefinition
);

router.get(
  "/admin/variables",
  requireAuth(),
  controller.getVariableDefinitions
);

router.delete(
  "/admin/variables/:key",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteVariableDefinition
);

module.exports = router;

