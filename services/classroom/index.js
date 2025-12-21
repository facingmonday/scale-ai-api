const express = require("express");
const controller = require("./classroom.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Admin routes - require org:admin role
// These will be mounted at /v1/admin/class when registered
router.post("/", requireAuth(), checkRole("org:admin"), controller.createClass);

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

router.get("/", requireAuth(), controller.getAllClassrooms);

module.exports = router;
