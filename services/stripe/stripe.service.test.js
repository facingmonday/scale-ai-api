const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSuccessUrl, buildCancelUrl } = require("./stripe.service");

test("Stripe Checkout success URL preserves the session placeholder", () => {
  const originalAppHost = process.env.SCALE_APP_HOST;
  delete process.env.SCALE_APP_HOST;

  try {
    const url = buildSuccessUrl({
      type: "student_seat",
      organization: { clerkOrganizationId: "org_test" },
      classroom: { _id: "classroom_test" },
    });

    assert.match(url, /session_id=\{CHECKOUT_SESSION_ID\}/);
    assert.doesNotMatch(url, /session_id=%7BCHECKOUT_SESSION_ID%7D/i);
  } finally {
    if (originalAppHost === undefined) {
      delete process.env.SCALE_APP_HOST;
    } else {
      process.env.SCALE_APP_HOST = originalAppHost;
    }
  }
});

test("Stripe Checkout cancel URL falls back to the app host", () => {
  const originalAppHost = process.env.SCALE_APP_HOST;
  const originalCancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;
  process.env.SCALE_APP_HOST = "https://app.scalelxp.com";
  delete process.env.STRIPE_CHECKOUT_CANCEL_URL;

  try {
    const url = buildCancelUrl({
      type: "student_seat",
      organization: { clerkOrganizationId: "org_test" },
      classroom: { _id: "classroom_test" },
    });

    assert.equal(
      url,
      "https://app.scalelxp.com/?checkout=cancelled&checkoutType=student_seat&orgId=org_test&classroomId=classroom_test",
    );
  } finally {
    if (originalAppHost === undefined) {
      delete process.env.SCALE_APP_HOST;
    } else {
      process.env.SCALE_APP_HOST = originalAppHost;
    }

    if (originalCancelUrl === undefined) {
      delete process.env.STRIPE_CHECKOUT_CANCEL_URL;
    } else {
      process.env.STRIPE_CHECKOUT_CANCEL_URL = originalCancelUrl;
    }
  }
});
