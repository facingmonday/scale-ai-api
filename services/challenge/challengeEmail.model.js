const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

// Each scheduled reminder becomes one durable send run. Recipient IDs are frozen
// when claimed; eligibility is checked again by the delivery worker.
const schema = new mongoose.Schema({
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Challenge",
  },
  audience: { type: String, enum: ["all", "missing"], required: true },
  kind: { type: String, enum: ["manual", "scheduled"], required: true },
  requestKey: { type: String, required: true },
  sendAt: { type: Date, required: true },
  timezone: { type: String, required: true },
  status: {
    type: String,
    enum: [
      "scheduled",
      "pending",
      "dispatching",
      "dispatched",
      "skipped",
      "cancelled",
      "failed",
    ],
    required: true,
  },
  recipients: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
  leaseUntil: Date,
  leaseToken: String,
  attempts: { type: Number, default: 0 },
  error: String,
  completedAt: Date,
}).add(baseSchema);
schema.index(
  { organization: 1, challengeId: 1, requestKey: 1 },
  { unique: true },
);
schema.index({ status: 1, sendAt: 1, leaseUntil: 1 });
module.exports = mongoose.model("ChallengeEmail", schema);
