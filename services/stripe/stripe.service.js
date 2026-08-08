const Stripe = require("stripe");
const { getStripeConfig } = require("./stripe.config");
const { PLAN_KEYS } = require("../licensing/planCatalog");

let stripeClient = null;
const CHECKOUT_SESSION_ID_PLACEHOLDER = "{CHECKOUT_SESSION_ID}";

function getStripeClient() {
  if (!stripeClient) {
    const { secretKey } = getStripeConfig();
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

function serializeCheckoutSuccessUrl(url) {
  // Stripe replaces the literal placeholder in the redirect URL. URLSearchParams
  // percent-encodes its braces, so restore them after safely constructing the URL.
  return url
    .toString()
    .replace(/%7BCHECKOUT_SESSION_ID%7D/gi, CHECKOUT_SESSION_ID_PLACEHOLDER);
}

function buildSuccessUrl({
  type,
  organization,
  classroom,
  clerkOrganizationId,
}) {
  const appHost = process.env.SCALE_APP_HOST || "http://localhost:5173";

  if (type === "org_seats") {
    const url = new URL(`${appHost}/settings`);
    url.searchParams.set("tab", "billing");
    url.searchParams.set("checkout", "success");
    url.searchParams.set("session_id", CHECKOUT_SESSION_ID_PLACEHOLDER);
    return serializeCheckoutSuccessUrl(url);
  }

  const base =
    process.env.STRIPE_CHECKOUT_SUCCESS_URL || `${appHost}/?checkout=success`;

  const url = new URL(base);
  url.searchParams.set("checkout", "success");
  url.searchParams.set("checkoutType", type);
  url.searchParams.set(
    "orgId",
    clerkOrganizationId || organization.clerkOrganizationId,
  );

  if (type === "student_seat" && classroom?._id) {
    url.searchParams.set("classroomId", String(classroom._id));
  }

  if (!url.searchParams.has("session_id")) {
    url.searchParams.set("session_id", CHECKOUT_SESSION_ID_PLACEHOLDER);
  }

  return serializeCheckoutSuccessUrl(url);
}

function buildCancelUrl({
  type,
  organization,
  classroom,
  clerkOrganizationId,
}) {
  const base =
    process.env.STRIPE_CHECKOUT_CANCEL_URL ||
    `${process.env.SCALE_APP_ADMIN || "http://localhost:5173"}/?checkout=cancelled`;

  const url = new URL(base);
  url.searchParams.set("checkout", "cancelled");
  url.searchParams.set("checkoutType", type);
  url.searchParams.set(
    "orgId",
    clerkOrganizationId || organization.clerkOrganizationId,
  );

  if (type === "student_seat" && classroom?._id) {
    url.searchParams.set("classroomId", String(classroom._id));
  }

  return url.toString();
}

async function createOrgSeatCheckoutSession({
  organization,
  member,
  quantity,
  customerEmail,
}) {
  const stripe = getStripeClient();
  const { priceId } = getStripeConfig();
  const seatCount = Math.max(Number(quantity || 1), 1);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: priceId,
        quantity: seatCount,
      },
    ],
    success_url: buildSuccessUrl({
      type: "org_seats",
      organization,
    }),
    cancel_url: buildCancelUrl({
      type: "org_seats",
      organization,
    }),
    client_reference_id: String(organization._id),
    metadata: {
      type: "org_seats",
      organizationId: String(organization._id),
      clerkOrganizationId: organization.clerkOrganizationId || "",
      purchaserUserId: String(member._id),
      quantity: String(seatCount),
      planKey: PLAN_KEYS.ORG_SEATS,
    },
    customer_email: customerEmail || member.email || undefined,
  });

  return session;
}

async function createStudentSeatCheckoutSession({
  organization,
  member,
  classroom,
  customerEmail,
}) {
  const stripe = getStripeClient();
  const { priceId } = getStripeConfig();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: buildSuccessUrl({
      type: "student_seat",
      organization,
      classroom,
    }),
    cancel_url: buildCancelUrl({
      type: "student_seat",
      organization,
      classroom,
    }),
    client_reference_id: `${organization._id}:${member._id}:${classroom._id}`,
    metadata: {
      type: "student_seat",
      organizationId: String(organization._id),
      clerkOrganizationId: organization.clerkOrganizationId || "",
      purchaserUserId: String(member._id),
      classroomId: String(classroom._id),
      quantity: "1",
      planKey: PLAN_KEYS.STUDENT_CLASS_PASS,
    },
    customer_email: customerEmail || member.email || undefined,
  });

  return session;
}

module.exports = {
  getStripeClient,
  buildSuccessUrl,
  createOrgSeatCheckoutSession,
  createStudentSeatCheckoutSession,
};
