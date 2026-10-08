const Stripe = require("stripe");
const { getStripeConfig } = require("./stripe.config");
const StripeCheckoutRecord = require("../licensing/stripeCheckoutRecord.model");
const SeatClaim = require("../licensing/seatClaim.model");
const Classroom = require("../classroom/classroom.model");
const Member = require("../members/member.model");
const { addSeats } = require("../licensing/seatCredit.service");

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

  if (
    !sessionId ||
    !["org_seats", "student_seat"].includes(type) ||
    !organizationId
  ) {
    throw new Error("Stripe checkout session missing required metadata");
  }

  // Completed records also cover purchases made before the credit ledger existed.
  await StripeCheckoutRecord.init();
  const existing = await StripeCheckoutRecord.findOne({
    stripeSessionId: sessionId,
  });
  if (
    existing &&
    (String(existing.organization) !== String(organizationId) ||
      existing.type !== type)
  ) {
    throw new Error(
      "Stripe checkout session conflicts with its recorded organization or type",
    );
  }
  if (existing?.status === "completed")
    return { duplicate: true, record: existing };

  const quantity = type === "org_seats" ? Number(metadata.quantity) : 1;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Stripe checkout seat quantity must be a positive integer");
  }

  let record = existing;
  if (!record) {
    try {
      record = await StripeCheckoutRecord.findOneAndUpdate(
        { stripeSessionId: sessionId },
        {
          $setOnInsert: {
            stripeSessionId: sessionId,
            type,
            purchaserUserId,
            classroomId: classroomId || undefined,
            quantity,
            status: "pending",
            organization: organizationId,
            updatedBy: "stripe_webhook",
            metadata: {
              ...metadata,
              paymentStatus: session.payment_status,
            },
            createdBy: "stripe_webhook",
          },
        },
        { upsert: true, new: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      record = await StripeCheckoutRecord.findOne({
        stripeSessionId: sessionId,
      });
      if (!record) throw error;
    }
  }

  if (
    String(record.organization) !== String(organizationId) ||
    record.type !== type ||
    record.quantity !== quantity
  ) {
    throw new Error(
      "Stripe checkout session conflicts with its recorded seat purchase",
    );
  }
  // Never regress a completed record to processing during a concurrent replay.
  const processingRecord = await StripeCheckoutRecord.findOneAndUpdate(
    {
      _id: record._id,
      organization: organizationId,
      status: { $ne: "completed" },
    },
    { $set: { status: "processing", updatedBy: "stripe_webhook" } },
    { new: true },
  );
  if (!processingRecord) {
    return {
      duplicate: true,
      record: await StripeCheckoutRecord.findById(record._id),
    };
  }

  let result = {};

  if (type === "org_seats") {
    const creditResult = await addSeats({
      organizationId,
      quantity,
      source: "stripe",
      referenceId: sessionId,
      actor: "stripe_webhook",
    });
    result = { pool: creditResult.pool, quantity, credit: creditResult.credit };
  } else if (type === "student_seat") {
    if (!classroomId || !purchaserUserId) {
      throw new Error(
        "Student seat checkout missing classroomId or purchaserUserId",
      );
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      throw new Error(
        `Classroom not found for student seat checkout: ${classroomId}`,
      );
    }

    const member = await Member.findById(purchaserUserId);
    if (!member) {
      throw new Error(
        `Member not found for student seat checkout: ${purchaserUserId}`,
      );
    }

    const existingClaim = await SeatClaim.findActiveClaim(
      classroomId,
      purchaserUserId,
    );
    if (existingClaim) {
      result = { claim: existingClaim, alreadyClaimed: true };
    } else {
      const reusableClaim = await SeatClaim.findReusableStudentClaim({
        organizationId,
        userId: purchaserUserId,
      });

      if (reusableClaim) {
        const repointed = await SeatClaim.repointStudentClaim({
          claim: reusableClaim,
          classroom,
          member,
          rosterSeat: null,
          updatedBy: "stripe_webhook",
        });
        repointed.metadata = {
          ...(repointed.metadata || {}),
          stripeSessionId: sessionId,
        };
        await repointed.save();
        result = { claim: repointed, reused: true };
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
    }
  } else {
    throw new Error(`Unknown Stripe checkout type: ${type}`);
  }

  record = await StripeCheckoutRecord.findByIdAndUpdate(
    processingRecord._id,
    {
      $set: {
        status: "completed",
        processedAt: new Date(),
        updatedBy: "stripe_webhook",
      },
    },
    { new: true },
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
