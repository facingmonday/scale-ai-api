/**
 * VariableDefinition Service Routes
 * 
 * Provides endpoints for managing dynamic variable definitions.
 * Variables define the structure of questions/inputs for profiles, challenges, decisions, and outcomes.
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
/**
 * @openapi
 * /v1/admin/variables:
 *   post:
 *     summary: Create variable definition
 *     description: Define a new dynamic system variable. Requires org:admin role.
 *     tags:
 *       - Variable Definitions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VariableDefinition'
 *     responses:
 *       201:
 *         description: Created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VariableDefinition'
 */
router.post(
  "/admin/variables",
  requireAuth(),
  checkRole("org:admin"),
  controller.createVariableDefinition
);

/**
 * @openapi
 * /v1/admin/variables/{key}:
 *   put:
 *     summary: Update variable definition
 *     description: Modify variable definition settings by key. Requires org:admin role.
 *     tags:
 *       - Variable Definitions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VariableDefinition'
 *     responses:
 *       200:
 *         description: Updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VariableDefinition'
 */
router.put(
  "/admin/variables/:key",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateVariableDefinition
);

/**
 * @openapi
 * /v1/admin/variables:
 *   get:
 *     summary: Get all variable definitions
 *     description: Retrieve all variable definitions configured in the classroom.
 *     tags:
 *       - Variable Definitions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of variable definitions.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VariableDefinition'
 */
router.get(
  "/admin/variables",
  requireAuth(),
  controller.getVariableDefinitions
);

/**
 * @openapi
 * /v1/admin/variables/{key}:
 *   delete:
 *     summary: Delete variable definition
 *     description: Delete variable definition record by key. Requires org:admin role.
 *     tags:
 *       - Variable Definitions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted successfully.
 */
router.delete(
  "/admin/variables/:key",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteVariableDefinition
);

module.exports = router;

