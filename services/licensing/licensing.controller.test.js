const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./licensing.controller");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");
const Organization = require("../organizations/organization.model");
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
    delete req.organization;
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

  await t.test("student checkout resolves the join-link organization before membership", async (t) => {
    configureStripe(t);
    const organization = {
      _id: "507f1f77bcf86cd799439011",
      clerkOrganizationId: "org_test",
    };
    const classroom = {
      _id: "507f1f77bcf86cd799439012",
      organization: organization._id,
    };
    const findOrganization = t.mock.method(
      Organization,
      "findOne",
      async () => organization,
    );
    const findClassroom = t.mock.method(
      Classroom,
      "findOne",
      async () => classroom,
    );

    const stripe = stripeService.getStripeClient();
    const createSession = t.mock.method(
      stripe.checkout.sessions,
      "create",
      async () => ({
        id: "cs_test_pre_membership",
        url: "https://checkout.stripe.test/pre-membership",
      }),
    );
    const req = createRequest({
      classroomId: classroom._id,
      orgId: organization.clerkOrganizationId,
    });
    delete req.organization;
    const res = createResponse();
    let nextError;

    await controller.createStudentCheckout(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.sessionId, "cs_test_pre_membership");
    assert.deepEqual(findOrganization.mock.calls[0].arguments[0], {
      clerkOrganizationId: "org_test",
    });
    assert.deepEqual(findClassroom.mock.calls[0].arguments[0], {
      _id: classroom._id,
      organization: organization._id,
    });
    assert.equal(createSession.mock.callCount(), 1);
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

  await t.test("grant seat resolves an organization member by email", async (t) => {
    const classroom = { _id: "507f1f77bcf86cd799439012" };
    const member = {
      _id: "507f191e810c19729de860eb",
      getOrganizationMembership: () => ({ id: "orgmem_test" }),
    };
    const grantResult = { decision: "manual_comp" };
    t.mock.method(Classroom, "validateAdminAccess", async () => classroom);
    const findMember = t.mock.method(Member, "findByEmail", async () => member);
    const grantSeat = t.mock.method(
      Enrollment,
      "grantOrgSeatAndEnroll",
      async () => grantResult,
    );
    const req = createRequest({
      email: " Student@Example.com ",
      classroomId: classroom._id,
      source: "manual_comp",
      reason: "Makeup enrollment",
    });
    const res = createResponse();
    let nextError;

    await controller.grantSeat(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, grantResult);
    assert.equal(findMember.mock.calls[0].arguments[0], "student@example.com");
    assert.equal(grantSeat.mock.calls[0].arguments[0].member, member);
    assert.equal(
      grantSeat.mock.calls[0].arguments[0].organization,
      req.organization,
    );
  });

  await t.test("grant seat rejects a member outside the organization", async (t) => {
    const classroom = { _id: "507f1f77bcf86cd799439012" };
    const member = {
      _id: "507f191e810c19729de860eb",
      getOrganizationMembership: () => null,
    };
    t.mock.method(Classroom, "validateAdminAccess", async () => classroom);
    t.mock.method(Member, "findByEmail", async () => member);
    const grantSeat = t.mock.method(
      Enrollment,
      "grantOrgSeatAndEnroll",
      async () => ({ decision: "manual_comp" }),
    );
    const req = createRequest({
      email: "outsider@example.com",
      classroomId: classroom._id,
    });
    const res = createResponse();
    let nextError;

    await controller.grantSeat(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /No organization member found/);
    assert.equal(grantSeat.mock.callCount(), 0);
  });
});
