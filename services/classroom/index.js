/**
 * Classroom Service Routes
 *
 * Provides endpoints for managing classrooms (courses).
 * Admin routes require org:admin role.
 * Mounted at: /v1/admin/class
 */
const express = require("express");
const controller = require("./classroom.controller");
const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

// Admin routes - require org:admin role
// These will be mounted at /v1/admin/class when registered

/**
 * @openapi
 * /v1/admin/class:
 *   post:
 *     summary: Create classroom
 *     description: Creates a new classroom. Requires org:admin role.
 *     tags:
 *       - Classrooms
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
 *         description: Classroom created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Classroom'
 *   get:
 *     summary: Get all classrooms
 *     description: Get a list of all classrooms in the organization.
 *     tags:
 *       - Classrooms
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of classrooms.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Classroom'
 */
router.post("/", requireAuth(), checkRole("org:admin"), controller.createClass);

// Admin maintenance utilities
/**
 * @openapi
 * /v1/admin/class/{classroomId}/variables:
 *   delete:
 *     summary: Delete classroom variables
 *     description: Delete variables defined in the classroom. Requires org:admin role.
 *     tags:
 *       - Classrooms
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Variables deleted.
 */
router.delete(
  "/:classroomId/variables",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteClassroomVariables
);

/**
 * @openapi
 * /v1/admin/class/{classroomId}/restore-template:
 *   post:
 *     summary: Restore template definitions
 *     description: Reset variables in the classroom to match global template. Requires org:admin role.
 *     tags:
 *       - Classrooms
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Classroom variables restored.
 */
router.post(
  "/:classroomId/restore-template",
  requireAuth(),
  checkRole("org:admin"),
  controller.restoreClassroomTemplate
);

/**
 * @openapi
 * /v1/admin/class/{classroomId}/dashboard:
 *   get:
 *     summary: Get instructor dashboard
 *     description: Fetch dashboard statistics and lists for classroom management. Requires org:admin role.
 *     tags:
 *       - Classrooms
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dashboard statistics.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InstructorDashboard'
 */
router.get(
  "/:classroomId/dashboard",
  requireAuth(),
  checkRole("org:admin"),
  controller.getClassDashboard
);

/**
 * @openapi
 * /v1/admin/class/student/{classroomId}/dashboard:
 *   get:
 *     summary: Get student view dashboard (Instructor context)
 *     description: Get dashboard statistics in student format. Requires org:admin role.
 *     tags:
 *       - Classrooms
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student dashboard view statistics.
 */
router.get(
  "student/:classroomId/dashboard",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStudentDashboard
);

/**
 * @openapi
 * /v1/admin/class/{classroomId}/invite:
 *   post:
 *     summary: Invite student
 *     description: Invite student by email to classroom. Requires org:admin role.
 *     tags:
 *       - Classrooms
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Student invited.
 */
router.post(
  "/:classroomId/invite",
  requireAuth(),
  checkRole("org:admin"),
  controller.inviteStudent
);

/**
 * @openapi
 * /v1/admin/class/{classroomId}:
 *   put:
 *     summary: Update classroom
 *     description: Update classroom settings. Requires org:admin role.
 *     tags:
 *       - Classrooms
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Classroom updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Classroom'
 *   delete:
 *     summary: Delete classroom
 *     description: Delete a classroom. Requires org:admin role.
 *     tags:
 *       - Classrooms
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Classroom deleted.
 */
router.put(
  "/:classroomId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateClass
);
router.delete(
  "/:classroomId",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteClass
);

router.get("/", requireAuth(), controller.getAllClassrooms);

module.exports = router;
