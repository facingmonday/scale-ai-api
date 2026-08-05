/**
 * Outcome Service Routes
 * 
 * Provides endpoints for managing challenge outcomes (global results that affect all students).
 * Includes admin routes (setting outcomes) and student routes (viewing outcomes after results are published).
 * Mounted at: /v1/admin/outcomes and /v1/student/outcomes
 */
const express = require("express");
const controller = require("./outcome.controller");
const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

// Admin routes - require org:admin role
/**
 * @openapi
 * /v1/admin/outcomes/{challengeId}/outcome:
 *   post:
 *     summary: Set global challenge outcome
 *     description: Save and immediately process the global outcome for a specific challenge. Requires org:admin role.
 *     tags:
 *       - Outcomes
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
 *         description: Outcome set and processing started.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Outcome'
 *   get:
 *     summary: Get challenge outcome (Instructor)
 *     description: Fetch the outcome settings for a challenge. Requires org:admin role.
 *     tags:
 *       - Outcomes
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
 *         description: Outcome data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Outcome'
 *   delete:
 *     summary: Delete scenario outcome
 *     description: Deletes the outcome records for a challenge. Requires org:admin role.
 *     tags:
 *       - Outcomes
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
 *         description: Outcome deleted.
 */
router.post(
  "/admin/outcomes/:challengeId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.setScenarioOutcome
);

/**
 * @openapi
 * /v1/admin/outcomes/{challengeId}/outcome/draft:
 *   post:
 *     summary: Save outcome draft
 *     description: Save a draft of the global challenge outcome without publishing or triggering calculation jobs. Requires org:admin role.
 *     tags:
 *       - Outcomes
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
 *         description: Draft saved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Outcome'
 */
router.post(
  "/admin/outcomes/:challengeId/outcome/draft",
  requireAuth(),
  checkRole("org:admin"),
  controller.saveScenarioOutcomeDraft
);

/**
 * @openapi
 * /v1/admin/outcomes/{challengeId}/outcome/approve:
 *   post:
 *     summary: Approve scenario outcome
 *     description: Approve and finalize the draft outcome. Requires org:admin role.
 *     tags:
 *       - Outcomes
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
 *         description: Outcome approved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Outcome'
 */
router.post(
  "/admin/outcomes/:challengeId/outcome/approve",
  requireAuth(),
  checkRole("org:admin"),
  controller.approveScenarioOutcome
);

router.get(
  "/admin/outcomes/:challengeId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.getScenarioOutcome
);

// Update outcome variables (dynamic variable values for "outcome" scope)
/**
 * @openapi
 * /v1/admin/outcomes/{challengeId}/outcome/variables:
 *   put:
 *     summary: Update outcome variables
 *     description: Update the variable values mapped to this outcome. Requires org:admin role.
 *     tags:
 *       - Outcomes
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
 *         description: Outcome variables updated.
 */
router.put(
  "/admin/outcomes/:challengeId/outcome/variables",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateScenarioOutcomeVariables
);

// Delete challenge outcome
router.delete(
  "/admin/outcomes/:challengeId/outcome",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteScenarioOutcome
);

// Student routes
/**
 * @openapi
 * /v1/student/outcomes/{challengeId}/outcome:
 *   get:
 *     summary: Get scenario outcome (Student)
 *     description: Fetch the published global outcome for a classroom challenge. Requires org:member role.
 *     tags:
 *       - Outcomes
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
 *         description: Outcome data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Outcome'
 */
router.get(
  "/student/outcomes/:challengeId/outcome",
  requireAuth(),
  checkRole("org:member"),
  controller.getScenarioOutcome
);

module.exports = router;
