/**
 * Authentication Service Routes
 * 
 * Provides endpoints for user authentication and session management.
 * Mounted at: /v1/auth
 */
const express = require("express");
const controller = require("./auth.controller");

const { requireAuth, checkRole } = require("../../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /v1/auth/me:
 *   get:
 *     summary: Get active user session info
 *     description: Returns the currently authenticated user profile, organization, active classroom, available UI routes, and billing summary.
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched current session info.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *                 organization:
 *                   type: object
 *                   nullable: true
 *                 activeClassroom:
 *                   type: object
 *                   nullable: true
 *                 routes:
 *                   type: array
 *                   items:
 *                     type: string
 *                 billing:
 *                   type: object
 *       403:
 *         description: Forbidden. User membership does not exist for the active organization.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", requireAuth({ organizationOptional: true }), controller.me);

/**
 * @openapi
 * /v1/auth/active-classroom:
 *   post:
 *     summary: Set or clear the active classroom for the user session
 *     description: Sets the active classroom to scope operations, or clears it if no classroomId is provided.
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               classroomId:
 *                 type: string
 *                 description: The Mongoose ID of the classroom, or null/empty to clear.
 *                 example: "60c72b2f9b1d8b2d1c8b4567"
 *     responses:
 *       200:
 *         description: Active classroom updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 activeClassroom:
 *                   type: object
 *                   nullable: true
 *       403:
 *         description: Forbidden. Classroom does not belong to user's organization or user is not enrolled.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Classroom not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/active-classroom", requireAuth(), controller.setActiveClassroom);

module.exports = router;
