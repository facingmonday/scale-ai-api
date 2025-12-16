const express = require("express");

const router = express.Router();

// Import webhook routers
const clerkWebhookRouter = require("./clerk");
const stripeWebhookRouter = require("./stripe");
const telnyxWebhookRouter = require("./telnyx");

// Mount webhook routers
router.use("/clerk", clerkWebhookRouter);
router.use("/stripe", stripeWebhookRouter);
router.use("/telnyx", telnyxWebhookRouter);

module.exports = router;
