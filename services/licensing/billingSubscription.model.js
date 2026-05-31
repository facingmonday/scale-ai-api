const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const billingSubscriptionSchema = new mongoose.Schema({
  clerkSubscriptionId: {
    type: String,
    index: true,
    sparse: true,
  },
  clerkCustomerId: {
    type: String,
    index: true,
    sparse: true,
  },
  planKey: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: [
      "active",
      "trialing",
      "past_due",
      "canceled",
      "incomplete",
      "expired",
      "manual",
    ],
    default: "active",
    index: true,
  },
  purchaserScope: {
    type: String,
    enum: ["user", "organization"],
    required: true,
    index: true,
  },
  purchaserUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    index: true,
  },
  purchaserOrganizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    index: true,
  },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  canceledAt: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}).add(baseSchema);

billingSubscriptionSchema.index(
  { clerkSubscriptionId: 1 },
  {
    unique: true,
    sparse: true,
  }
);
billingSubscriptionSchema.index({ organization: 1, status: 1, planKey: 1 });

const BillingSubscription = mongoose.model(
  "BillingSubscription",
  billingSubscriptionSchema
);

module.exports = BillingSubscription;
