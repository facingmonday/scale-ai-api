const express = require("express");
const controller = require("./enrollment.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// enrollment/index.js
router.get("/my-classes", requireMemberAuth(), controller.getMyClasses);

// Admin routes - require org:admin role
router.get(
  "/admin/class/:classId/roster",
  requireAuth(),
  checkRole("org:admin"),
  controller.getClassRoster
);

router.delete(
  "/admin/class/:classId/student/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.removeStudent
);

// Student routes - require authenticated member
router.post("/class/:classId/join", requireMemberAuth(), controller.joinClass);

module.exports = router;
