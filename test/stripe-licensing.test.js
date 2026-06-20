const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PLAN_KEYS,
  PLAN_CATALOG,
  getPlan,
  getDefaultFreeTeacherLimits,
} = require("../services/licensing/planCatalog");
const {
  getStripeConfig,
  isStripeConfigured,
} = require("../services/stripe/stripe.config");

test("plan catalog defines org and student stripe plans", () => {
  assert.equal(PLAN_CATALOG[PLAN_KEYS.ORG_SEATS].purchaserScope, "organization");
  assert.equal(
    PLAN_CATALOG[PLAN_KEYS.STUDENT_CLASS_PASS].features.perEnrollment,
    true
  );
});

test("getPlan returns null for unknown plans", () => {
  assert.equal(getPlan("does_not_exist"), null);
});

test("free teacher limits remain available", () => {
  const limits = getDefaultFreeTeacherLimits();
  assert.equal(limits.planKey, "free_teacher_workspace");
  assert.equal(typeof limits.classroomLimit, "number");
  assert.equal(limits.classroomLimit > 0, true);
});

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
