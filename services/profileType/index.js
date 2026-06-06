/**
 * ProfileType Service Routes
 *
 * Provides endpoints for managing profile types.
 * Profile types are organization-specific and define default variable values for profile types.
 * Admin routes require org:admin role.
 * Mounted at: /v1/admin/profile-types
 */
const express = require("express");
const controller = require("./profileType.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Student routes - require authenticated member
/**
 * @openapi
 * /v1/student/profile-types:
 *   get:
 *     summary: Get profile types for student
 *     description: Retrieve all profile types/store templates available in the active classroom.
 *     tags:
 *       - Profile Types
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of store templates.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProfileType'
 */
router.get(
  "/student/profile-types",
  requireMemberAuth(),
  controller.getStoreTypesForStudent
);

// Admin routes - require org:admin role
/**
 * @openapi
 * /v1/admin/profile-types:
 *   post:
 *     summary: Create profile type template
 *     description: Define a new profile type template. Requires org:admin role.
 *     tags:
 *       - Profile Types
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Profile type template created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProfileType'
 */
router.post(
  "/admin/profile-types",
  requireAuth(),
  checkRole("org:admin"),
  controller.createStoreType
);

/**
 * @openapi
 * /v1/admin/profile-types/{storeTypeId}:
 *   put:
 *     summary: Update profile type template
 *     description: Modify settings of a profile type template. Requires org:admin role.
 *     tags:
 *       - Profile Types
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: storeTypeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProfileType'
 */
router.put(
  "/admin/profile-types/:storeTypeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateStoreType
);

/**
 * @openapi
 * /v1/admin/profile-types:
 *   get:
 *     summary: Get all profile types (Instructor)
 *     description: Retrieve all profile types configured. Requires org:admin role.
 *     tags:
 *       - Profile Types
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of profile types.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProfileType'
 */
router.get(
  "/admin/profile-types",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStoreTypes
);

/**
 * @openapi
 * /v1/admin/profile-types/{storeTypeId}:
 *   get:
 *     summary: Get profile type by ID
 *     description: Retrieve detailed configurations for a specific profile type template. Requires org:admin role.
 *     tags:
 *       - Profile Types
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: storeTypeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile type configuration.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProfileType'
 */
router.get(
  "/admin/profile-types/:storeTypeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStoreType
);

/**
 * @openapi
 * /v1/admin/profile-types/{storeTypeId}:
 *   delete:
 *     summary: Delete profile type template
 *     description: Removes a profile type template. Requires org:admin role.
 *     tags:
 *       - Profile Types
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: storeTypeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted successfully.
 */
router.delete(
  "/admin/profile-types/:storeTypeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteStoreType
);

module.exports = router;
