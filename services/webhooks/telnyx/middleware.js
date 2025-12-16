const crypto = require("crypto");

/**
 * Verify Telnyx webhook signature
 * Based on Telnyx webhook security documentation
 */
exports.verifyTelnyxSignature = (req, res, next) => {
  try {
    const signatureHeader = req.headers["telnyx-signature-ed25519"];
    const timestampHeader = req.headers["telnyx-timestamp"];

    if (!signatureHeader || !timestampHeader) {
      return res
        .status(400)
        .send("Missing Telnyx signature or timestamp headers");
    }

    // Get the webhook secret from environment
    const webhookSecret = process.env.TELNYX_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn(
        "TELNYX_WEBHOOK_SECRET not configured, skipping signature verification"
      );
      return next();
    }

    // Create the payload string
    const payload = JSON.stringify(req.body);
    const timestamp = timestampHeader;
    const signedPayload = timestamp + "." + payload;

    // Create the expected signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload, "utf8")
      .digest("hex");

    // Compare signatures
    if (signatureHeader !== expectedSignature) {
      console.error("Telnyx webhook signature verification failed");
      return res.status(400).send("Invalid signature");
    }

    // Check timestamp to prevent replay attacks (5 minute window)
    const currentTime = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp);

    if (Math.abs(currentTime - webhookTime) > 300) {
      // 5 minutes
      console.error("Telnyx webhook timestamp too old");
      return res.status(400).send("Timestamp too old");
    }

    req.telnyxEvent = req.body;
    return next();
  } catch (error) {
    console.error("Telnyx webhook verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
};
