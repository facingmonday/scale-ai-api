const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const stripeCheckoutRecordSchema = new mongoose.Schema({
  stripeSessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["org_seats", "student_seat"],
    required: true,
    index: true,
  },
  purchaserUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    index: true,
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    index: true,
  },
  quantity: {
    type: Number,
    default: 1,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
    index: true,
  },
  processedAt: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}).add(baseSchema);

stripeCheckoutRecordSchema.index({ organization: 1, status: 1, type: 1 });

const StripeCheckoutRecord = mongoose.model(
  "StripeCheckoutRecord",
  stripeCheckoutRecordSchema
);

module.exports = StripeCheckoutRecord;
