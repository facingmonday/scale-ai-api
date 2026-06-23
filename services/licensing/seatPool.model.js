const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const seatPoolSchema = new mongoose.Schema({
  planKey: {
    type: String,
    required: true,
    index: true,
  },
  scope: {
    type: String,
    enum: ["user", "teacher", "organization"],
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
  totalSeats: {
    type: Number,
    default: 1,
  },
  usedSeats: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "past_due", "canceled", "expired", "manual"],
    default: "active",
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}).add(baseSchema);

seatPoolSchema.virtual("remainingSeats").get(function () {
  if (this.totalSeats === null || this.totalSeats === undefined) return null;
  return Math.max(this.totalSeats - (this.usedSeats || 0), 0);
});

seatPoolSchema.statics.findActiveForOrganization = function (organizationId) {
  return this.find({
    organization: organizationId,
    status: { $in: ["active", "manual"] },
  });
};

seatPoolSchema.statics.findActiveForUser = function (organizationId, userId) {
  return this.find({
    organization: organizationId,
    purchaserUserId: userId,
    status: { $in: ["active", "manual"] },
  });
};

const SeatPool = mongoose.model("SeatPool", seatPoolSchema);

module.exports = SeatPool;
