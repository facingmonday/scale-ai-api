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
router.post("/student/profile", requireMemberAuth(), controller.createStore);
router.put("/student/profile", requireMemberAuth(), controller.updateStore);
router.get("/student/profile", requireMemberAuth(), controller.getStore);

// Admin routes - require org:admin role
router.get(
  "/admin/class/:classroomId/profile/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStudentStore
);

module.exports = router;
