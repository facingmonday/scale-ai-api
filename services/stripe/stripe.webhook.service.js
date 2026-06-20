const Stripe = require("stripe");
const { getStripeConfig } = require("./stripe.config");
const StripeCheckoutRecord = require("../licensing/stripeCheckoutRecord.model");
const SeatClaim = require("../licensing/seatClaim.model");
const Classroom = require("../classroom/classroom.model");
const Member = require("../members/member.model");
const {
  findOrCreateOrgSeatPool,
} = require("../licensing/licensing.service");

function verifyWebhookSignature(rawBody, signature) {
  const { secretKey, webhookSecret } = getStripeConfig();
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  const stripe = new Stripe(secretKey);
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

async function processCheckoutSessionCompleted(session) {
  const sessionId = session.id;
  const metadata = session.metadata || {};
  const type = metadata.type;
  const organizationId = metadata.organizationId;
  const purchaserUserId = metadata.purchaserUserId;
  const classroomId = metadata.classroomId;

  if (!type || !organizationId) {
    throw new Error("Stripe checkout session missing required metadata");
  }

  const quantity =
    type === "org_seats" ? Math.max(Number(metadata.quantity || 1), 1) : 1;

  const lock = await StripeCheckoutRecord.findOneAndUpdate(
    {
      stripeSessionId: sessionId,
      status: { $ne: "completed" },
    },
    {
      $set: {
        stripeSessionId: sessionId,
        type,
        purchaserUserId,
        classroomId: classroomId || undefined,
        quantity,
        status: "processing",
        organization: organizationId,
        updatedBy: "stripe_webhook",
        metadata: {
          ...metadata,
          paymentStatus: session.payment_status,
        },
      },
      $setOnInsert: {
        createdBy: "stripe_webhook",
      },
    },
    { upsert: true, new: true }
  );

  const alreadyCompleted = await StripeCheckoutRecord.findOne({
    stripeSessionId: sessionId,
    status: "completed",
  });
  if (alreadyCompleted && String(alreadyCompleted._id) !== String(lock._id)) {
    return { duplicate: true, record: alreadyCompleted };
  }
  if (lock.status === "completed") {
    return { duplicate: true, record: lock };
  }

  let result = {};

  if (type === "org_seats") {
    const pool = await findOrCreateOrgSeatPool(
      { _id: organizationId },
      "stripe_webhook"
    );
    pool.totalSeats = (pool.totalSeats || 0) + quantity;
    pool.updatedBy = "stripe_webhook";
    await pool.save();
    result = { pool, quantity };
  } else if (type === "student_seat") {
    if (!classroomId || !purchaserUserId) {
      throw new Error(
        "Student seat checkout missing classroomId or purchaserUserId"
      );
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      throw new Error(`Classroom not found for student seat checkout: ${classroomId}`);
    }

    const member = await Member.findById(purchaserUserId);
    if (!member) {
      throw new Error(`Member not found for student seat checkout: ${purchaserUserId}`);
    }

    const existingClaim = await SeatClaim.findActiveClaim(
      classroomId,
      purchaserUserId
    );
    if (existingClaim) {
      result = { claim: existingClaim, alreadyClaimed: true };
    } else {
      const claim = new SeatClaim({
        classroomId,
        userId: purchaserUserId,
        source: "stripe_student",
        organization: organizationId,
        createdBy: "stripe_webhook",
        updatedBy: "stripe_webhook",
        metadata: {
          stripeSessionId: sessionId,
        },
      });
      await claim.save();
      result = { claim };
    }
  } else {
    throw new Error(`Unknown Stripe checkout type: ${type}`);
  }

  const record = await StripeCheckoutRecord.findByIdAndUpdate(
    lock._id,
    {
      $set: {
        status: "completed",
        processedAt: new Date(),
        updatedBy: "stripe_webhook",
      },
    },
    { new: true }
  );

  return { duplicate: false, type, record, ...result };
}

async function handleStripeWebhookEvent(event) {
  switch (event.type) {
    case "checkout.session.completed":
      return processCheckoutSessionCompleted(event.data.object);
    default:
      return { ignored: true, type: event.type };
  }
}

module.exports = {
  verifyWebhookSignature,
  handleStripeWebhookEvent,
  processCheckoutSessionCompleted,
};
