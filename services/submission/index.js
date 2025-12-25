/**
 * Submission Service Routes
 *
 * Provides endpoints for managing student submissions (weekly decisions).
 * Includes student routes (creating/updating submissions) and admin routes (viewing all submissions).
 * Mounted at: /v1/student/submission and /v1/admin/submissions
 */
const express = require("express");
const controller = require("./submission.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Admin routes - require authenticated admin
router.get(
  "/admin/submissions/:submissionId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmission
);
router.get(
  "/admin/submissions",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmissions
);

router.get(
  "/admin/submissions/student/:studentId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getAllSubmissionsForUser
);
// Student routes - require authenticated member
router.post(
  "/student/submission",
  requireMemberAuth(),
  controller.submitWeeklyDecisions
);

router.put(
  "/student/submission/:submissionId",
  requireMemberAuth(),
  controller.updateWeeklyDecisions
);

router.get(
  "/student/submission/status",
  requireMemberAuth(),
  controller.getSubmissionStatus
);

router.get(
  "/student/submissions",
  requireMemberAuth(),
  controller.getStudentSubmissions
);

// Admin routes - require org:admin role
/**
 * Get all submissions for a scenario
 * GET /api/admin/scenarios/:scenarioId/submissions
 * @param {string} scenarioId - Scenario ID
 * @returns {Object} Submission data
 * @returns {boolean} success - Whether the request was successful
 * @returns {Object} data - Submission data
 * @returns {Array} submissions - Array of submissions
 * @returns {Object} submissions.member - Member data
 * @returns {string} submissions.member._id - Member ID
 * @returns {string} submissions.member.clerkUserId - Clerk User ID
 * @returns {string} submissions.member.firstName - First Name
 * @returns {string} submissions.member.lastName - Last Name
 * @returns {string} submissions.member.maskedEmail - Masked Email
 * @returns {Object} submissions.variables - Variables
 * @returns {string} submissions.variables.variableKey - Variable Key
 * @returns {string} submissions.variables.value - Variable Value
 * @returns {Date} submissions.submittedAt - Submission Date
 */
router.get(
  "/admin/scenarios/:scenarioId/submissions",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmissionsForScenario
);

module.exports = router;
