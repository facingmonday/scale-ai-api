/**
 * Join Service Routes
 *
 * Implements the public join flow (authenticated, idempotent).
 * Mounted at:
 * - /v1/join (via services/index.js)
 * - /api/join (via apps/api/index.js)
 */
const express = require("express");
const { requireMemberAuth } = require("../../middleware/auth");
const controller = require("./join.controller");

const router = express.Router();
/**
 * @openapi
 * /v1/join:
 *   post:
 *     summary: Request to join classroom flow
 *     description: Endpoint for authenticated user to trigger the classroom template onboarding flow.
 *     tags:
 *       - Onboarding & Join
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarded successfully.
 */
router.post("/", requireMemberAuth(), controller.join);

module.exports = router;


