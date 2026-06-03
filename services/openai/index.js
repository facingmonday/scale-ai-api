/**
 * OpenAI Service Routes
 *
 * Provides endpoints for AI-powered features (completions, image generation, transcription, etc.).
 * All routes require org:admin role.
 * Mounted at: /v1/openai
 */
const express = require("express");
const controller = require("./openai.controller");
const { upload } = require("../../lib/spaces");

const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

router.post("/completion", requireAuth(), controller.completion);
router.post("/generate", requireAuth(), controller.generateImage);


module.exports = router;
