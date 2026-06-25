const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getStripeConfig,
  isStripeConfigured,
} = require("./stripe.config");

test("stripe config requires price id prefix", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalPrice = process.env.STRIPE_SEAT_PRICE_ID;

  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env.STRIPE_SEAT_PRICE_ID = "prod_invalid";

  assert.throws(
    () => getStripeConfig(),
    /STRIPE_SEAT_PRICE_ID must be set to a Stripe price ID/
  );
  assert.equal(isStripeConfigured(), false);

  process.env.STRIPE_SEAT_PRICE_ID = "price_test_example";
  const config = getStripeConfig();
  assert.equal(config.priceId, "price_test_example");

  process.env.STRIPE_SECRET_KEY = originalSecret;
  process.env.STRIPE_SEAT_PRICE_ID = originalPrice;
});
