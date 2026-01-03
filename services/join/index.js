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

router.post("/", requireMemberAuth(), controller.join);

module.exports = router;


