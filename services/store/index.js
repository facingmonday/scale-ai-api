const express = require("express");
const controller = require("./store.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Student routes - require authenticated member
router.post(
  "/student/store",
  requireMemberAuth(),
  controller.createStore
);

router.get(
  "/student/store",
  requireMemberAuth(),
  controller.getStore
);

// Admin routes - require org:admin role
router.get(
  "/admin/class/:classId/store/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStudentStore
);

module.exports = router;

