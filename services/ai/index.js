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

// Automation Task Management Endpoints
router.get("/automation-tasks", requireAuth(), requireActiveClassroom(), controller.getAutomationTasks);
router.post("/automation-tasks", requireAuth(), requireActiveClassroom(), controller.createAutomationTask);
router.put("/automation-tasks/:id", requireAuth(), requireActiveClassroom(), controller.updateAutomationTask);
router.delete("/automation-tasks/:id", requireAuth(), requireActiveClassroom(), controller.deleteAutomationTask);
router.get("/automation-tasks/runs", requireAuth(), requireActiveClassroom(), controller.getAutomationTaskRuns);

module.exports = router;
