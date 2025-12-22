/**
 * Store Service Routes
 * 
 * Provides endpoints for managing student stores (pizza shop businesses).
 * Includes student routes (creating/updating their own store) and admin routes (viewing student stores).
 * Mounted at: /v1/student/store and /v1/admin/class/:classroomId/store/:userId
 */
const express = require("express");
const controller = require("./store.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Student routes - require authenticated member
router.post("/student/store", requireMemberAuth(), controller.createStore);
router.put("/student/store", requireMemberAuth(), controller.updateStore);
router.get("/student/store", requireMemberAuth(), controller.getStore);

// Admin routes - require org:admin role
router.get(
  "/admin/class/:classroomId/store/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStudentStore
);

module.exports = router;
