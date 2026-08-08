const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./licensing.controller");
const Classroom = require("../classroom/classroom.model");
const stripeService = require("../stripe/stripe.service");
const { PLAN_CATALOG } = require("./planCatalog");

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest(body = {}) {
  return {
    body,
    organization: {
      _id: "507f1f77bcf86cd799439011",
      clerkOrganizationId: "org_test",
    },
    user: {
      _id: "507f191e810c19729de860ea",
      email: "student@example.com",
    },
    clerkUser: {
      id: "user_test",
      primaryEmailAddressId: "email_primary",
      emailAddresses: [
        {
          id: "email_primary",
          emailAddress: "student@example.com",
        },
      ],
    },
  };
}

function clearStripeConfiguration(t) {
  const originalSecretKey = process.env.STRIPE_SECRET_KEY;
  const originalPriceId = process.env.STRIPE_SEAT_PRICE_ID;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SEAT_PRICE_ID;
  t.after(() => {
    if (originalSecretKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecretKey;
    }
    if (originalPriceId === undefined) {
      delete process.env.STRIPE_SEAT_PRICE_ID;
    } else {
      process.env.STRIPE_SEAT_PRICE_ID = originalPriceId;
    }
  });
}

function configureStripe(t) {
  const originalSecretKey = process.env.STRIPE_SECRET_KEY;
  const originalPriceId = process.env.STRIPE_SEAT_PRICE_ID;
  process.env.STRIPE_SECRET_KEY = "sk_test_controller";
  process.env.STRIPE_SEAT_PRICE_ID = "price_controller";
  t.after(() => {
    if (originalSecretKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecretKey;
    }
    if (originalPriceId === undefined) {
      delete process.env.STRIPE_SEAT_PRICE_ID;
    } else {
      process.env.STRIPE_SEAT_PRICE_ID = originalPriceId;
    }
  });
}

test("licensing controller", async (t) => {
  await t.test("getPlans returns plan catalog", async () => {
    const res = createResponse();

    await controller.getPlans({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, PLAN_CATALOG);
  });

  await t.test("student checkout returns 501 when Stripe is unconfigured", async (t) => {
    clearStripeConfiguration(t);
    const req = createRequest({ classroomId: "507f1f77bcf86cd799439012" });
    const res = createResponse();
    let nextError;

    await controller.createStudentCheckout(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 501);
    assert.deepEqual(res.body, {
      success: false,
      error: "Stripe checkout is not configured.",
    });
  });

  await t.test("organization checkout returns 501 when Stripe is unconfigured", async (t) => {
    clearStripeConfiguration(t);
    const req = createRequest({ quantity: 4 });
    const res = createResponse();
    let nextError;

    await controller.createOrgCheckout(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 501);
    assert.deepEqual(res.body, {
      success: false,
      error: "Stripe checkout is not configured.",
    });
  });

  await t.test("student checkout status remains pending until Stripe marks the session paid", async (t) => {
    configureStripe(t);
    const stripe = stripeService.getStripeClient();
    const retrieveSession = t.mock.method(
      stripe.checkout.sessions,
      "retrieve",
      async () => ({
        id: "cs_test_pending",
        payment_status: "unpaid",
        metadata: {
          type: "student_seat",
          organizationId: "507f1f77bcf86cd799439011",
          purchaserUserId: "507f191e810c19729de860ea",
          classroomId: "507f1f77bcf86cd799439012",
        },
      }),
    );
    const req = createRequest();
    req.query = { sessionId: "cs_test_pending" };
    const res = createResponse();
    let nextError;

    await controller.getStudentCheckoutStatus(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true,
      data: {
        status: "pending",
        paymentStatus: "unpaid",
      },
    });
    assert.equal(retrieveSession.mock.callCount(), 1);
  });

  await t.test("configured student checkout creates a Stripe session", async (t) => {
    configureStripe(t);
    const classroom = {
      _id: "507f1f77bcf86cd799439012",
      organization: "507f1f77bcf86cd799439011",
    };
    t.mock.method(Classroom, "findOne", async () => classroom);

    const stripe = stripeService.getStripeClient();
    const createSession = t.mock.method(
      stripe.checkout.sessions,
      "create",
      async () => ({
        id: "cs_test_student",
        url: "https://checkout.stripe.test/student",
      }),
    );
    const req = createRequest({ classroomId: classroom._id });
    const res = createResponse();
    let nextError;

    await controller.createStudentCheckout(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.sessionId, "cs_test_student");
    assert.equal(res.body.data.checkoutUrl, "https://checkout.stripe.test/student");
    assert.equal(createSession.mock.callCount(), 1);
    const options = createSession.mock.calls[0].arguments[0];
    assert.equal(options.metadata.type, "student_seat");
    assert.equal(options.metadata.organizationId, req.organization._id);
    assert.equal(options.metadata.purchaserUserId, req.user._id);
    assert.equal(options.metadata.classroomId, classroom._id);
    assert.equal(options.line_items[0].quantity, 1);
  });

  await t.test("configured organization checkout creates a Stripe session", async (t) => {
    configureStripe(t);
    const stripe = stripeService.getStripeClient();
    const createSession = t.mock.method(
      stripe.checkout.sessions,
      "create",
      async () => ({
        id: "cs_test_org",
        url: "https://checkout.stripe.test/org",
      }),
    );
    const req = createRequest({ quantity: 4 });
    const res = createResponse();
    let nextError;

    await controller.createOrgCheckout(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.sessionId, "cs_test_org");
    assert.equal(res.body.data.checkoutUrl, "https://checkout.stripe.test/org");
    assert.equal(res.body.data.quantity, 4);
    assert.equal(createSession.mock.callCount(), 1);
    const options = createSession.mock.calls[0].arguments[0];
    assert.equal(options.metadata.type, "org_seats");
    assert.equal(options.metadata.organizationId, req.organization._id);
    assert.equal(options.metadata.purchaserUserId, req.user._id);
    assert.equal(options.metadata.quantity, "4");
    assert.equal(options.line_items[0].quantity, 4);
  });
});
