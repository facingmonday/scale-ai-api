const express = require("express");
const router = express.Router();
const { handleWebhook, getDeliveryStats } = require("./telnyx.controller");
const { verifyTelnyxSignature } = require("./middleware");
const { requireAuth, checkRole } = require("../../../middleware/auth");

// Telnyx webhook endpoint (needs raw body for signature verification)
router.post(
  "/",
  express.raw({ type: "application/json" }),
  verifyTelnyxSignature,
  handleWebhook
);

// Delivery stats endpoint for dashboard
router.get(
  "/stats/:eventId",
  requireAuth(),
  checkRole("org:admin"),
  getDeliveryStats
);

module.exports = router;
