function getStripeConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_SEAT_PRICE_ID;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!priceId || !String(priceId).startsWith("price_")) {
    throw new Error(
      "STRIPE_SEAT_PRICE_ID must be set to a Stripe price ID (price_...)",
    );
  }

  return {
    secretKey,
    priceId,
    webhookSecret,
    productId: process.env.STRIPE_SEAT_PRODUCT_ID || null,
    successUrl:
      process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
      `${process.env.SCALE_APP_HOST || "http://localhost:5173"}/?checkout=success`,
    cancelUrl:
      process.env.STRIPE_CHECKOUT_CANCEL_URL ||
      `${process.env.SCALE_APP_HOST || "http://localhost:5173"}/?checkout=cancelled`,
  };
}

function isStripeConfigured() {
  try {
    getStripeConfig();
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getStripeConfig,
  isStripeConfigured,
};
