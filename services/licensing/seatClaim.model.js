const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const seatClaimSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    index: true,
  },
  seatPoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SeatPool",
    index: true,
  },
  allocationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClassroomSeatAllocation",
    index: true,
  },
  rosterSeatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RosterSeat",
    index: true,
  },
  orgSeatReservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OrgSeatReservation",
    index: true,
  },
  source: {
    type: String,
    enum: [
      "org_prepaid",
      "org_reserved",
      "stripe_student",
      "student_purchase",
      "teacher_assigned",
      "teacher_open",
      "enterprise",
      "manual_comp",
      "roster_reserved",
      "free_teacher_workspace",
    ],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["active", "revoked", "expired"],
    default: "active",
    index: true,
  },
  claimedAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}).add(baseSchema);

seatClaimSchema.index(
  { classroomId: 1, userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  }
);
seatClaimSchema.index({ organization: 1, classroomId: 1, status: 1 });

seatClaimSchema.statics.findActiveClaim = function (classroomId, userId) {
  return this.findOne({
    classroomId,
    userId,
    status: "active",
  });
};

const SeatClaim = mongoose.model("SeatClaim", seatClaimSchema);

module.exports = SeatClaim;
