const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const rosterSeatSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  allocationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClassroomSeatAllocation",
    index: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  studentId: {
    type: String,
    trim: true,
    default: "",
  },
  firstName: {
    type: String,
    trim: true,
    default: "",
  },
  lastName: {
    type: String,
    trim: true,
    default: "",
  },
  section: {
    type: String,
    trim: true,
    default: "",
  },
  status: {
    type: String,
    enum: ["reserved", "claimed", "revoked", "invalid"],
    default: "reserved",
    index: true,
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    index: true,
  },
  claimedAt: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}).add(baseSchema);

rosterSeatSchema.index(
  { classroomId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "revoked" } },
  },
);
rosterSeatSchema.index({ organization: 1, classroomId: 1, status: 1 });

rosterSeatSchema.statics.findReservableForEmail = function (
  classroomId,
  email,
) {
  return this.findOne({
    classroomId,
    email: String(email || "")
      .trim()
      .toLowerCase(),
    status: "reserved",
  });
};

const RosterSeat = mongoose.model("RosterSeat", rosterSeatSchema);

module.exports = RosterSeat;
