const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSuccessUrl } = require("./stripe.service");

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
