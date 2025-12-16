const { Webhook } = require("svix");
const Member = require("../../members/member.model");
const Organization = require("../../organizations/organization.model");

// Webhook signature verification
const verifyWebhook = (req, res, next) => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      throw new Error("CLERK_WEBHOOK_SECRET is not configured");
    }

    const wh = new Webhook(WEBHOOK_SECRET);
    const payload = req.body;
    const headers = req.headers;

    let evt;
    try {
      evt = wh.verify(payload, headers);
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return res.status(400).json({
        success: false,
        message: "Webhook verification failed",
      });
    }

    req.evt = evt;
    next();
  } catch (error) {
    console.error("Webhook verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  verifyWebhook,
};
