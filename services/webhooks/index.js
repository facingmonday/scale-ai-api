const express = require("express");

const router = express.Router();

// Import webhook routers
const clerkWebhookRouter = require("./clerk");

// Mount webhook routers
router.use("/clerk", clerkWebhookRouter);

module.exports = router;
