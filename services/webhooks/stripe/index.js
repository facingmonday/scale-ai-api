const express = require("express");
const router = express.Router();
const { handleWebhook } = require("./stripe.controller");
const { verifyStripeSignature } = require("./middleware");

// Stripe webhook endpoint (needs raw body)
router.post(
  "/",
  express.raw({ type: "application/json" }),
  verifyStripeSignature,
  handleWebhook
);

module.exports = router;
