const express = require("express");
const {
  verifyWebhookSignature,
  handleStripeWebhookEvent,
} = require("../../stripe/stripe.webhook.service");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).send("Stripe webhook endpoint OK");
});

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }

    try {
      const event = verifyWebhookSignature(req.body, signature);
      const result = await handleStripeWebhookEvent(event);
      return res.status(200).json({ received: true, result });
    } catch (error) {
      console.error("Stripe webhook error:", error.message);
      return res.status(400).json({ error: error.message });
    }
  },
);

module.exports = router;
