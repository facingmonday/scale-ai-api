const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const orgSeatReservationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["reserved", "claimed", "revoked"],
    default: "reserved",
    index: true,
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    index: true,
  },
  claimedAt: Date,
  claimedClassroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    index: true,
  },
}).add(baseSchema);

orgSeatReservationSchema.index(
  { organization: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "revoked" } },
  }
);
orgSeatReservationSchema.index({ organization: 1, status: 1 });

orgSeatReservationSchema.statics.findReservedForEmail = function (
  organizationId,
  email
) {
  return this.findOne({
    organization: organizationId,
    email: String(email || "").trim().toLowerCase(),
    status: "reserved",
  });
};

const OrgSeatReservation = mongoose.model(
  "OrgSeatReservation",
  orgSeatReservationSchema
);

module.exports = OrgSeatReservation;
