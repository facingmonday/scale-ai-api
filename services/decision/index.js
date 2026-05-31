/**
 * Decision Service Routes
 *
 * Provides endpoints for managing student decisions (weekly decisions).
 * Includes student routes (creating/updating decisions) and admin routes (viewing all decisions).
 * Mounted at: /v1/student/decision and /v1/admin/decisions
 */
const express = require("express");
const controller = require("./decision.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Admin routes - require authenticated admin
router.get(
  "/admin/decisions/:decisionId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmission
);
router.post(
  "/admin/decisions",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmissions
);

router.get(
  "/admin/decisions/student/:studentId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getAllSubmissionsForUser
);
// Student routes - require authenticated member
router.post(
  "/student/decision",
  requireMemberAuth(),
  controller.submitWeeklyDecisions
);

router.put(
  "/student/decision/:decisionId",
  requireMemberAuth(),
  controller.updateWeeklyDecisions
);

router.get(
  "/student/decision/status",
  requireMemberAuth(),
  controller.getSubmissionStatus
);

router.get(
  "/student/decisions",
  requireMemberAuth(),
  controller.getStudentSubmissions
);

// Admin routes - require org:admin role
/**
 * Get all decisions for a challenge
 * GET /api/admin/challenges/:challengeId/decisions
 * @param {string} challengeId - Challenge ID
 * @returns {Object} Decision data
 * @returns {boolean} success - Whether the request was successful
 * @returns {Object} data - Decision data
 * @returns {Array} decisions - Array of decisions
 * @returns {Object} decisions.member - Member data
 * @returns {string} decisions.member._id - Member ID
 * @returns {string} decisions.member.clerkUserId - Clerk User ID
 * @returns {string} decisions.member.firstName - First Name
 * @returns {string} decisions.member.lastName - Last Name
 * @returns {string} decisions.member.maskedEmail - Masked Email
 * @returns {Object} decisions.variables - Variables
 * @returns {string} decisions.variables.variableKey - Variable Key
 * @returns {string} decisions.variables.value - Variable Value
 * @returns {Date} decisions.submittedAt - Decision Date
 */
router.get(
  "/admin/challenges/:challengeId/decisions",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmissionsForScenario
);

router.get(
  "/admin/challenges/:challengeId/missing-decisions",
  requireAuth(),
  checkRole("org:admin"),
  controller.getMissingSubmissionsForScenario
);

module.exports = router;
