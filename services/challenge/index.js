/**
 * Challenge Service Routes
 *
 * Provides endpoints for managing challenges (weekly simulation contexts).
 * Includes admin routes (creating, publishing, managing challenges) and student routes (viewing challenges).
 * Mounted at: /v1/admin/challenges and /v1/student/challenges
 */
const express = require("express");
const controller = require("./challenge.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Admin routes - require org:admin role
// Put specific routes before parameterized routes
/**
 * @openapi
 * /v1/admin/challenges:
 *   post:
 *     summary: Create challenge
 *     description: Define a new scenario challenge in the classroom. Requires org:admin role.
 *     tags:
 *       - Challenges
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Challenge'
 */
router.post(
  "/admin/challenges",
  requireAuth(),
  checkRole("org:admin"),
  controller.createScenario
);

/**
 * @openapi
 * /v1/admin/challenges/ai:
 *   post:
 *     summary: Create a challenge with AI
 *     description: Generate and create a challenge, its student variables, schedule, and optional outcome from instructor source text. Requires org:admin role.
 *     tags:
 *       - Challenges
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classroomId, prompt]
 *             properties:
 *               classroomId:
 *                 type: string
 *               prompt:
 *                 type: string
 *               timeZone:
 *                 type: string
 *                 example: America/Chicago
 *     responses:
 *       201:
 *         description: Challenge generated and created successfully.
 */
router.post(
  "/admin/challenges/ai",
  requireAuth(),
  checkRole("org:admin"),
  controller.createScenarioWithAI,
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}:
 *   put:
 *     summary: Update challenge
 *     description: Update challenge details. Requires org:admin role.
 *     tags:
 *       - Challenges
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
 *         description: Updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Challenge'
 */
router.put(
  "/admin/challenges/:challengeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateScenario
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}/publish:
 *   post:
 *     summary: Publish challenge
 *     description: Set challenge status to active/published so students can submit decisions. Requires org:admin role.
 *     tags:
 *       - Challenges
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
 *         description: Published successfully.
 */
router.post(
  "/admin/challenges/:challengeId/publish",
  requireAuth(),
  checkRole("org:admin"),
  controller.publishScenario
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}/unpublish:
 *   post:
 *     summary: Unpublish challenge
 *     description: Hide challenge from students. Requires org:admin role.
 *     tags:
 *       - Challenges
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
 *         description: Unpublished successfully.
 */
router.post(
  "/admin/challenges/:challengeId/unpublish",
  requireAuth(),
  checkRole("org:admin"),
  controller.unpublishScenario
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}/preview:
 *   post:
 *     summary: Preview challenge outcomes by store type
 *     description: Runs fresh, synthetic Week 0 simulations in memory for active store types without creating decisions, jobs, ledgers, notifications, or student feedback. Requires org:admin role.
 *     tags:
 *       - Challenges
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: challengeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targets:
 *                 type: array
 *                 description: Optional failed cases to retry. Omit to run every applicable case for every active store type.
 *                 items:
 *                   type: object
 *                   required: [profileTypeId, case]
 *                   properties:
 *                     profileTypeId:
 *                       type: string
 *                     case:
 *                       type: string
 *                       enum: [baseline, absence_penalty]
 *     responses:
 *       200:
 *         description: Complete or partial synthetic preview results.
 *       400:
 *         description: Invalid retry target.
 *       409:
 *         description: Synthetic preview readiness checks failed.
 *       502:
 *         description: Every requested simulation case failed.
 */
router.post(
  "/admin/challenges/:challengeId/preview",
  requireAuth(),
  checkRole("org:admin"),
  controller.previewScenario
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}/rerun:
 *   post:
 *     summary: Rerun simulation jobs
 *     description: Retrigger calculations for all store outcomes for this scenario. Requires org:admin role.
 *     tags:
 *       - Challenges
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
 *         description: Rerun jobs enqueued.
 */
router.post(
  "/admin/challenges/:challengeId/rerun",
  requireAuth(),
  checkRole("org:admin"),
  controller.rerunScenario
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}/cancel-batch-and-rerun:
 *   post:
 *     summary: Cancel batch job and rerun
 *     description: Cancel running OpenAI Batch execution and trigger a rerun. Requires org:admin role.
 *     tags:
 *       - Challenges
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
 *         description: Batch cancelled and rerun initiated.
 */
router.post(
  "/admin/challenges/:challengeId/cancel-batch-and-rerun",
  requireAuth(),
  checkRole("org:admin"),
  controller.cancelBatchAndRerunScenario
);

/** Stop an in-progress calculation, discard its results, and reopen submissions. */
router.post(
  "/admin/challenges/:challengeId/stop-calculation-and-reopen",
  requireAuth(),
  checkRole("org:admin"),
  controller.stopCalculationAndReopenScenario
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}/release-feedback:
 *   post:
 *     summary: Release outcome feedback
 *     description: Release AI outcomes and feedback text to students. Requires org:admin role.
 *     tags:
 *       - Challenges
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
 *         description: Feedback released.
 */
router.post(
  "/admin/challenges/:challengeId/release-feedback",
  requireAuth(),
  checkRole("org:admin"),
  controller.releaseFeedbackScenario
);

/** Generate or regenerate the teacher-only challenge debrief. */
router.post(
  "/admin/challenges/:challengeId/debrief",
  requireAuth(),
  checkRole("org:admin"),
  controller.generateScenarioDebrief,
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}/export:
 *   post:
 *     summary: Export challenge submissions
 *     description: Trigger CSV export of all submissions for this challenge. Requires org:admin role.
 *     tags:
 *       - Challenges
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
 *         description: Export file trigger.
 */
router.post(
  "/admin/challenges/:challengeId/export",
  requireAuth(),
  checkRole("org:admin"),
  controller.exportScenario
);

/**
 * @openapi
 * /v1/admin/challenges:
 *   get:
 *     summary: Get all challenges (Instructor)
 *     description: Retrieve all challenge definitions. Requires org:admin role.
 *     tags:
 *       - Challenges
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of challenges.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Challenge'
 */
router.get(
  "/admin/challenges",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarios
);

/**
 * @openapi
 * /v1/admin/challenges/current:
 *   get:
 *     summary: Get current active challenge
 *     description: Fetch the current weekly challenge. Requires org:admin role.
 *     tags:
 *       - Challenges
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Active challenge details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Challenge'
 */
router.get(
  "/admin/challenges/current",
  requireAuth(),
  checkRole("org:admin"),
  controller.getCurrentScenarioForAdmin
);

/** Get challenge by id - must come after specific routes */
/**
 * @openapi
 * /v1/admin/challenges/{id}:
 *   get:
 *     summary: Get challenge by ID (Instructor)
 *     description: Fetch detailed challenge parameters. Requires org:admin role.
 *     tags:
 *       - Challenges
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Challenge details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Challenge'
 */
router.get(
  "/admin/challenges/:id",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarioById
);

/**
 * @openapi
 * /v1/admin/challenges/{challengeId}:
 *   delete:
 *     summary: Delete challenge
 *     description: Delete a challenge record. Requires org:admin role.
 *     tags:
 *       - Challenges
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
 *         description: Deleted successfully.
 */
router.delete(
  "/admin/challenges/:challengeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteScenario
);

// Student routes - require authenticated member

/**
 * @openapi
 * /v1/student/challenges/current:
 *   get:
 *     summary: Get current challenge (Student)
 *     description: Fetch active weekly challenge for the classroom.
 *     tags:
 *       - Challenges
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current challenge details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Challenge'
 */
router.get(
  "/student/challenges/current",
  requireMemberAuth(),
  controller.getCurrentScenario
);

/**
 * @openapi
 * /v1/student/challenges/{id}:
 *   get:
 *     summary: Get challenge details (Student)
 *     description: Get specific challenge parameters.
 *     tags:
 *       - Challenges
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Challenge details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Challenge'
 */
router.get(
  "/student/challenges/:id",
  requireMemberAuth(),
  controller.getScenarioByIdForStudent
);

/**
 * @openapi
 * /v1/student/challenges:
 *   get:
 *     summary: Get all classroom challenges (Student)
 *     description: Retrieve all challenge records for the current user's classroom.
 *     tags:
 *       - Challenges
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of challenges.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Challenge'
 */
router.get(
  "/student/challenges",
  requireMemberAuth(),
  controller.getStudentScenariosByClassroom
);

module.exports = router;
