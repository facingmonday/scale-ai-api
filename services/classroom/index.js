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
router.post("/", requireAuth(), checkRole("org:admin"), controller.createClass);

// Admin maintenance utilities
router.delete(
  "/:classroomId/variables",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteClassroomVariables
);

router.post(
  "/:classroomId/restore-template",
  requireAuth(),
  checkRole("org:admin"),
  controller.restoreClassroomTemplate
);

router.get(
  "/:classroomId/dashboard",
  requireAuth(),
  checkRole("org:admin"),
  controller.getClassDashboard
);

router.get(
  "student/:classroomId/dashboard",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStudentDashboard
);

router.post(
  "/:classroomId/invite",
  requireAuth(),
  checkRole("org:admin"),
  controller.inviteStudent
);

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
