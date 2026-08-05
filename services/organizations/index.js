/**
 * Organizations Service Routes
 * 
 * Provides endpoints for managing organizations.
 * Mounted at: /v1/organizations
 */
const express = require("express");
const { requireMemberAuth } = require("../../middleware/auth");
const organizationsController = require("./organizations.controller");
const router = express.Router();

// Get all organizations
/**
 * @openapi
 * /v1/organizations:
 *   get:
 *     summary: Get all organizations for the user
 *     description: Retrieve all organizations where the current user is a registered member.
 *     tags:
 *       - Organizations
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of organizations returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *   post:
 *     summary: Create a new organization
 *     description: Create a new organization under the user's account.
 *     tags:
 *       - Organizations
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organization created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 */
router.get(
  "/",
  requireMemberAuth(),
  organizationsController.getAllOrganizations
);

// Create a new organization
router.post(
  "/",
  requireMemberAuth(),
  organizationsController.createOrganization
);

// Join an organization
/**
 * @openapi
 * /v1/organizations/{organizationId}/join:
 *   post:
 *     summary: Join an organization
 *     description: Request to join a specific organization by its ID.
 *     tags:
 *       - Organizations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: organizationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Joined successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Organization not found.
 */
router.post(
  "/:organizationId/join",
  requireMemberAuth(),
  organizationsController.joinOrganization
);

module.exports = router;
