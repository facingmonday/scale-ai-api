const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const classroomSeatAllocationSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  seatPoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SeatPool",
    required: true,
    index: true,
  },
  seatsAllocated: {
    type: Number,
    required: true,
    min: 0,
  },
  seatsClaimed: {
    type: Number,
    default: 0,
    min: 0,
  },
  mode: {
    type: String,
    enum: ["open", "roster_reserved", "invite_only"],
    default: "open",
    index: true,
  },
  status: {
    type: String,
    enum: ["active", "paused", "expired", "revoked"],
    default: "active",
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}).add(baseSchema);

classroomSeatAllocationSchema.virtual("remainingSeats").get(function () {
  return Math.max((this.seatsAllocated || 0) - (this.seatsClaimed || 0), 0);
});

classroomSeatAllocationSchema.index({
  organization: 1,
  classroomId: 1,
  status: 1,
});

classroomSeatAllocationSchema.statics.findActiveForClassroom = function (
  classroomId
) {
  return this.find({
    classroomId,
    status: "active",
  }).populate("seatPoolId");
};

const ClassroomSeatAllocation = mongoose.model(
  "ClassroomSeatAllocation",
  classroomSeatAllocationSchema
);

module.exports = ClassroomSeatAllocation;
