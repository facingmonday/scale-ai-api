const express = require("express");
const controller = require("./submission.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Student routes - require authenticated member
router.post(
  "/student/submission",
  requireMemberAuth(),
  controller.submitWeeklyDecisions
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
router.get(
  "/admin/scenarios/:scenarioId/submissions",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmissionsForScenario
);

module.exports = router;
