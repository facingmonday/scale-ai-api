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
/**
 * @openapi
 * /v1/admin/decisions/{decisionId}:
 *   get:
 *     summary: Get specific student decision submission
 *     description: Retrieve a student's weekly decision submission by ID. Requires org:admin role.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: decisionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Decision submission returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Decision'
 */
router.get(
  "/admin/decisions/:decisionId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmission
);

/**
 * @openapi
 * /v1/admin/decisions/{decisionId}/recalculate:
 *   post:
 *     summary: Recalculate one student's completed challenge result
 *     description: Queues a direct simulation that replaces the existing ledger entry in place. Requires org:admin role.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: decisionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Recalculation queued.
 *       409:
 *         description: The result is not eligible or another calculation is active.
 */
router.post(
  "/admin/decisions/:decisionId/recalculate",
  requireAuth(),
  checkRole("org:admin"),
  controller.recalculateStudentResult
);

/**
 * @openapi
 * /v1/admin/decisions:
 *   post:
 *     summary: Query student decisions
 *     description: Retrieve decision submissions matching filters. Requires org:admin role.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of decisions.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Decision'
 */
router.post(
  "/admin/decisions",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmissions
);

/**
 * @openapi
 * /v1/admin/decisions/student/{studentId}:
 *   get:
 *     summary: Get all decisions for a student
 *     description: Fetch all decision submissions submitted by a specific student. Requires org:admin role.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: studentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of decisions.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Decision'
 */
router.get(
  "/admin/decisions/student/:studentId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getAllSubmissionsForUser
);

// Student routes - require authenticated member
/**
 * @openapi
 * /v1/student/decision:
 *   post:
 *     summary: Submit weekly decisions
 *     description: Create a weekly decision submission for the active classroom scenario.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - challengeId
 *               - variables
 *             properties:
 *               challengeId:
 *                 type: string
 *               variables:
 *                 type: object
 *                 description: Map of variable keys to values.
 *               challengeVariableAnswers:
 *                 type: object
 *                 description: Map of challenge-specific question keys to this student's answers.
 *     responses:
 *       201:
 *         description: Decisions submitted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Decision'
 */
router.post(
  "/student/decision",
  requireMemberAuth(),
  controller.submitWeeklyDecisions
);

/**
 * @openapi
 * /v1/student/decision/{decisionId}:
 *   put:
 *     summary: Update weekly decisions
 *     description: Modify a submitted weekly decision submission.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: decisionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               variables:
 *                 type: object
 *               challengeVariableAnswers:
 *                 type: object
 *                 description: Map of challenge-specific question keys to this student's answers.
 *     responses:
 *       200:
 *         description: Submission updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Decision'
 */
router.put(
  "/student/decision/:decisionId",
  requireMemberAuth(),
  controller.updateWeeklyDecisions
);

/**
 * @openapi
 * /v1/student/decision/status:
 *   get:
 *     summary: Get weekly decision submission status
 *     description: Check the submission status for the current week's scenario.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Submission status flags.
 */
router.get(
  "/student/decision/status",
  requireMemberAuth(),
  controller.getSubmissionStatus
);

/**
 * @openapi
 * /v1/student/decisions:
 *   get:
 *     summary: Get current student submissions
 *     description: Retrieve all weekly decision submissions created by the current user in the active classroom.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of submissions.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Decision'
 */
router.get(
  "/student/decisions",
  requireMemberAuth(),
  controller.getStudentSubmissions
);

// Admin routes - require org:admin role
/**
 * @openapi
 * /v1/admin/challenges/{challengeId}/decisions:
 *   get:
 *     summary: Get decisions for a scenario challenge
 *     description: Fetch all student decisions for a specific scenario challenge. Requires org:admin role.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: challengeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of decisions.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Decision'
 */
router.get(
  "/admin/challenges/:challengeId/decisions",
  requireAuth(),
  checkRole("org:admin"),
  controller.getSubmissionsForScenario
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}/missing-decisions:
 *   get:
 *     summary: Get missing submissions for scenario
 *     description: Identify students who have not submitted decisions for a specific scenario challenge. Requires org:admin role.
 *     tags:
 *       - Decisions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: challengeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of missing students.
 */
router.get(
  "/admin/challenges/:challengeId/missing-decisions",
  requireAuth(),
  checkRole("org:admin"),
  controller.getMissingSubmissionsForScenario
);

module.exports = router;
