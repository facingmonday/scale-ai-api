/**
 * Authentication Service Routes
 * 
 * Provides endpoints for user authentication and session management.
 * Mounted at: /v1/auth
 */
const express = require("express");
const controller = require("./auth.controller");

const { requireAuth, checkRole } = require("../../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth({ organizationOptional: true }), controller.me);
router.post("/active-classroom", requireAuth(), controller.setActiveClassroom);

module.exports = router;
