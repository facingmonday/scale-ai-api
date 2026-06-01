/**
 * AI Service Routes
 *
 * Provides endpoints for the AI-Powered Learning Assistant.
 * Mounted at: /v1/ai
 */
const express = require("express");
const controller = require("./ai.controller");
const router = express.Router();
const { requireAuth, requireActiveClassroom } = require("../../middleware/auth");

router.post("/chat", requireAuth(), requireActiveClassroom(), controller.chat);
router.get("/chat/history", requireAuth(), requireActiveClassroom(), controller.getChatHistory);
router.get("/reports", requireAuth(), requireActiveClassroom(), controller.getClassroomReports);

module.exports = router;
