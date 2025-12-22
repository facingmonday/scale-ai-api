/**
 * Webhooks Service Routes
 * 
 * Provides endpoints for handling external webhook events (Clerk, Stripe, Telnyx, etc.).
 * Mounted at: /v1/webhooks
 */
const express = require("express");

const router = express.Router();

// Import webhook routers
const clerkWebhookRouter = require("./clerk");

// Mount webhook routers
router.use("/clerk", clerkWebhookRouter);

module.exports = router;
