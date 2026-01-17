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
router.get("/my-classes", requireAuth(), controller.getMyClasses);

// Admin routes - require org:admin role
/**
 * Get class roster
 * GET /api/admin/class/:classroomId/roster?page=0&pageSize=50&search=term
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {string} search - Optional search term to filter by firstName, lastName, or combined displayName
 * @returns {Object} Class roster
 * @returns {number} total
 * @returns {number} hasMore
 * @returns {Array} data
 * @returns {Object} page
 * @returns {Object} pageSize
 * @returns {Object} total
 * @returns {Object} hasMore
 * @returns {Object} data
 */

router.get(
  "/admin/class/:classroomId/roster",
  requireAuth(),
  checkRole("org:admin"),
  controller.getClassRoster
);

router.post(
  "/admin/class/:classroomId/roster/export",
  requireAuth(),
  checkRole("org:admin"),
  controller.exportRoster
);

router.delete(
  "/admin/class/:classroomId/student/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.removeStudent
);

// Student routes - require authenticated member
router.post(
  "/class/:classroomId/join",
  requireMemberAuth(),
  controller.joinClass
);

module.exports = router;
