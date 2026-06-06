/**
 * Ledger Service Routes
 *
 * Provides endpoints for managing ledger entries (historical results for students).
 * Mounted at: /v1/admin/ledger
 *
 * The ledger entry now profiles a dynamic `metrics` map keyed by MetricDefinition
 * records for the classroom, rather than a fixed set of fields.
 */
const express = require("express");
const controller = require("./ledger.controller");
const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

// Get ledger history for a user
/**
 * @openapi
 * /v1/admin/ledger/{classroomId}/user/{userId}:
 *   get:
 *     summary: Get ledger history for a student
 *     description: Retrieve historical ledger entries for a student user within a classroom. Accessible by admin and members of the classroom.
 *     tags:
 *       - Ledgers
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: classroomId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Historical ledger records list.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LedgerEntry'
 */
router.get(
  "/:classroomId/user/:userId",
  requireAuth(),
  checkRole(["org:admin", "org:member"]),
  controller.getLedgerHistory
);

// Get ledger entries for a challenge
/**
 * @openapi
 * /v1/admin/ledger/challenge/{challengeId}:
 *   get:
 *     summary: Get ledger entries for a scenario challenge
 *     description: Fetch all student ledger outcome entries generated for a specific challenge. Requires org:admin role.
 *     tags:
 *       - Ledgers
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
 *         description: List of ledger entries.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LedgerEntry'
 */
router.get(
  "/challenge/:challengeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getLedgerEntriesByChallenge
);

// Get ledger entry for a specific challenge and user
/**
 * @openapi
 * /v1/admin/ledger/challenge/{challengeId}/user/{userId}:
 *   get:
 *     summary: Get specific student ledger entry for a challenge
 *     description: Retrieve the ledger entry for a specific student and challenge. Requires org:admin role.
 *     tags:
 *       - Ledgers
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: challengeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ledger entry object.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LedgerEntry'
 */
router.get(
  "/challenge/:challengeId/user/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getLedgerEntry
);

// Override a ledger entry
/**
 * @openapi
 * /v1/admin/ledger/{ledgerId}/override:
 *   patch:
 *     summary: Override ledger entry metrics
 *     description: Allows the instructor to manually override metrics and values in a student ledger entry. Requires org:admin role.
 *     tags:
 *       - Ledgers
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: ledgerId
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
 *               metrics:
 *                 type: object
 *                 description: Map of metric keys to overridden values.
 *     responses:
 *       200:
 *         description: Ledger entry updated with overrides.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LedgerEntry'
 */
router.patch(
  "/:ledgerId/override",
  requireAuth(),
  checkRole("org:admin"),
  controller.overrideLedgerEntry
);

module.exports = router;
