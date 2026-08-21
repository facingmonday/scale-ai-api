/**
 * Enrollment Service Routes
 *
 * Provides endpoints for managing student enrollments in classrooms.
 * Includes both student routes (joining classes) and admin routes (managing rosters).
 * Mounted at: /v1/enrollment
 */
const express = require("express");
const controller = require("./enrollment.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// enrollment/index.js
/**
 * @openapi
 * /v1/enrollment/my-classes:
 *   get:
 *     summary: Get user classes
 *     description: Retrieve all classrooms in which the current user is enrolled.
 *     tags:
 *       - Enrollments
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of classrooms.
 */
router.get("/my-classes", requireAuth(), controller.getMyClasses);

// Admin routes - require org:admin role

/**
 * @openapi
 * /v1/enrollment/admin/class/{classroomId}/roster:
 *   get:
 *     summary: Get classroom roster
 *     description: Fetch enrolled student profiles for a classroom. Requires org:admin role.
 *     tags:
 *       - Enrollments
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *       - name: pageSize
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: search
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Roster object.
 */
router.get(
  "/admin/class/:classroomId/roster",
  requireAuth(),
  checkRole("org:admin"),
  controller.getClassRoster
);

/**
 * @openapi
 * /v1/enrollment/admin/class/{classroomId}/roster/export:
 *   post:
 *     summary: Export roster as CSV
 *     description: Generates and exports the classroom student roster in CSV format. Requires org:admin role.
 *     tags:
 *       - Enrollments
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
 *         description: File download trigger.
 */
router.post(
  "/admin/class/:classroomId/roster/export",
  requireAuth(),
  checkRole("org:admin"),
  controller.exportRoster
);

/**
 * @openapi
 * /v1/enrollment/admin/class/{classroomId}/student/{userId}:
 *   delete:
 *     summary: Remove student from classroom
 *     description: Deactivates/removes a student's enrollment in a classroom. Requires org:admin role.
 *     tags:
 *       - Enrollments
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
 *         description: Student removed successfully.
 */
router.delete(
  "/admin/class/:classroomId/student/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.removeStudent
);

/**
 * @openapi
 * /v1/enrollment/admin/class/{classroomId}/student/{userId}:
 *   patch:
 *     summary: Update a student's classroom enrollment
 *     description: Updates classroom-specific enrollment data, including the student ID. Requires org:admin role.
 *     tags:
 *       - Enrollments
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentId
 *             properties:
 *               studentId:
 *                 type: string
 *                 maxLength: 20
 *     responses:
 *       200:
 *         description: Enrollment updated successfully.
 */
router.patch(
  "/admin/class/:classroomId/student/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateStudentEnrollment
);

/**
 * @openapi
 * /v1/enrollment/admin/transfer:
 *   post:
 *     summary: Transfer student to another classroom
 *     description: Moves a student and their organization seat claim to another classroom in the same organization. Requires org:admin role.
 *     tags:
 *       - Enrollments
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - fromClassroomId
 *               - toClassroomId
 *             properties:
 *               userId:
 *                 type: string
 *               fromClassroomId:
 *                 type: string
 *               toClassroomId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Student transferred successfully.
 */
router.post(
  "/admin/transfer",
  requireAuth(),
  checkRole("org:admin"),
  controller.transferStudent
);

// Student routes - require authenticated member
/**
 * @openapi
 * /v1/enrollment/class/{classroomId}/join:
 *   post:
 *     summary: Join a classroom
 *     description: Enroll the authenticated user into a classroom.
 *     tags:
 *       - Enrollments
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accessCode:
 *                 type: string
 *                 description: Code to authenticate the join request.
 *     responses:
 *       200:
 *         description: Successfully joined classroom.
 */
router.post(
  "/class/:classroomId/join",
  requireMemberAuth(),
  controller.joinClass
);

router.post(
  "/class/:classroomId/leave",
  requireMemberAuth(),
  controller.leaveClass
);

module.exports = router;
