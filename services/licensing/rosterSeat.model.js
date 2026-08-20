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

rosterSeatSchema.statics.importRows = async function ({
  classroom,
  rows,
  updatedBy,
}) {
  const upserted = [];

  for (const row of rows) {
    const doc = await this.findOneAndUpdate(
      {
        classroomId: classroom._id,
        organization: classroom.organization,
        email: row.email,
        status: { $ne: "revoked" },
      },
      {
        $set: {
          ...row,
          organization: classroom.organization,
          updatedBy,
        },
        $setOnInsert: {
          status: "reserved",
          createdBy: updatedBy,
        },
      },
      { new: true, upsert: true },
    );
    upserted.push(doc);
  }

  return upserted;
};

rosterSeatSchema.statics.clearForClassroom = async function ({
  classroomId,
  organizationId,
  updatedBy,
}) {
  const SeatClaim = require("./seatClaim.model");
  const rosterSeats = await this.find({
    classroomId,
    organization: organizationId,
  })
    .select("_id")
    .lean();
  const rosterSeatIds = rosterSeats.map((seat) => seat._id);

  if (rosterSeatIds.length === 0) {
    return { deleted: 0, detachedClaims: 0 };
  }

  const detached = await SeatClaim.updateMany(
    {
      classroomId,
      organization: organizationId,
      rosterSeatId: { $in: rosterSeatIds },
    },
    {
      $unset: { rosterSeatId: "" },
      $set: { updatedBy },
    },
  );
  const deleted = await this.deleteMany({
    _id: { $in: rosterSeatIds },
    classroomId,
    organization: organizationId,
  });

  return {
    deleted: deleted.deletedCount || 0,
    detachedClaims: detached.modifiedCount || 0,
  };
};

rosterSeatSchema.statics.removeSeat = async function ({
  classroomId,
  organizationId,
  seatId,
  updatedBy,
}) {
  const SeatClaim = require("./seatClaim.model");
  const rosterSeat = await this.findOne({
    _id: seatId,
    classroomId,
    organization: organizationId,
  })
    .select("_id")
    .lean();

  if (!rosterSeat) {
    return null;
  }

  const detached = await SeatClaim.updateMany(
    {
      classroomId,
      organization: organizationId,
      rosterSeatId: rosterSeat._id,
    },
    {
      $unset: { rosterSeatId: "" },
      $set: { updatedBy },
    },
  );
  const deleted = await this.deleteOne({
    _id: rosterSeat._id,
    classroomId,
    organization: organizationId,
  });

  return {
    deleted: deleted.deletedCount || 0,
    detachedClaims: detached.modifiedCount || 0,
  };
};

rosterSeatSchema.statics.findReservableForEmail = function (
  classroomId,
  email,
  organizationId,
) {
  return this.findOne({
    classroomId,
    organization: organizationId,
    email: String(email || "")
      .trim()
      .toLowerCase(),
    status: "reserved",
  });
};

rosterSeatSchema.statics.releaseForClaim = async function (claim, updatedBy) {
  if (!claim?.rosterSeatId) return;

  const rosterSeat = await this.findById(claim.rosterSeatId);
  if (!rosterSeat) return;

  rosterSeat.status = "reserved";
  rosterSeat.claimedBy = undefined;
  rosterSeat.claimedAt = undefined;
  rosterSeat.updatedBy = updatedBy;
  await rosterSeat.save();
};

rosterSeatSchema.statics.attachForClaim = async function ({
  claim,
  member,
  classroomId,
  updatedBy,
}) {
  const SeatClaim = require("./seatClaim.model");
  const email = SeatClaim.getPrimaryEmail(member);
  if (!email) return null;

  const rosterSeat = await this.findReservableForEmail(
    classroomId,
    email,
    claim.organization,
  );
  if (!rosterSeat) return null;

  rosterSeat.status = "claimed";
  rosterSeat.claimedBy = member._id;
  rosterSeat.claimedAt = new Date();
  rosterSeat.updatedBy = updatedBy;
  await rosterSeat.save();

  claim.rosterSeatId = rosterSeat._id;
  return rosterSeat;
};

const RosterSeat = mongoose.model("RosterSeat", rosterSeatSchema);

module.exports = RosterSeat;
