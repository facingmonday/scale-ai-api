/**
 * Profile Service Routes
 * 
 * Provides endpoints for managing student profiles (simulated business/entity per class).
 * Includes student routes (creating/updating their own profile) and admin routes (viewing student profiles).
 * Mounted at: /v1/student/profile and /v1/admin/class/:classroomId/profile/:userId
 */
const express = require("express");
const controller = require("./profile.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Student routes - require authenticated member
/**
 * @openapi
 * /v1/student/profile:
 *   post:
 *     summary: Create student store profile
 *     description: Initializes the student's store profile for the active classroom.
 *     tags:
 *       - Profiles
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeName
 *               - profileTypeId
 *             properties:
 *               storeName:
 *                 type: string
 *               profileTypeId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Profile created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *   put:
 *     summary: Update student store profile
 *     description: Update student's store details.
 *     tags:
 *       - Profiles
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *   get:
 *     summary: Get student store profile
 *     description: Retrieves the student's store profile in the active classroom.
 *     tags:
 *       - Profiles
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Store profile object returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 */
router.post("/student/profile", requireMemberAuth(), controller.createStore);
router.put("/student/profile", requireMemberAuth(), controller.updateStore);
router.get("/student/profile", requireMemberAuth(), controller.getStore);

// Admin routes - require org:admin role
/**
 * @openapi
 * /v1/admin/class/{classroomId}/profile/{userId}:
 *   get:
 *     summary: Get specific student store profile (Instructor)
 *     description: Retrieve a specific student's store profile within a classroom. Requires org:admin role.
 *     tags:
 *       - Profiles
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student store profile object returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 */
router.get(
  "/admin/class/:classroomId/profile/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStudentStore
);

module.exports = router;
