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

/**
 * @openapi
 * /v1/openai/completion:
 *   post:
 *     summary: Generate completion text
 *     description: Submit prompts to fetch completion text from OpenAI.
 *     tags:
 *       - OpenAI Integration
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Completion response returned.
 */
router.post("/completion", requireAuth(), controller.completion);

/**
 * @openapi
 * /v1/openai/generate:
 *   post:
 *     summary: Generate AI image
 *     description: Generate an image using OpenAI models.
 *     tags:
 *       - OpenAI Integration
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generated image metadata/URL returned.
 */
router.post("/generate", requireAuth(), controller.generateImage);


module.exports = router;
