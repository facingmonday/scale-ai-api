const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.verifyStripeSignature = (req, res, next) => {
  try {
    const signatureHeader = req.headers["stripe-signature"];
    if (!signatureHeader) {
      return res.status(400).send("Missing Stripe signature header");
    }

    let event;
    try {
      // Try main account webhook secret first
      event = stripe.webhooks.constructEvent(
        req.body,
        signatureHeader,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      // If that fails, try connected account webhook secret
      event = stripe.webhooks.constructEvent(
        req.body,
        signatureHeader,
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET
      );
    }

    req.stripeEvent = event;
    return next();
  } catch (error) {
    console.error("Stripe webhook verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
};
