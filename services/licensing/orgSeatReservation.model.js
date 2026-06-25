const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const { makeReservationError } = require("./licensing.errors");

const ACTIVE_POOL_STATUSES = ["active", "manual"];

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
  },
);
orgSeatReservationSchema.index({ organization: 1, status: 1 });

orgSeatReservationSchema.statics.normalizeEmail = function (email) {
  return String(email || "").trim().toLowerCase();
};

orgSeatReservationSchema.statics.findReservedForEmail = function (
  organizationId,
  email,
) {
  return this.findOne({
    organization: organizationId,
    email: this.normalizeEmail(email),
    status: "reserved",
  });
};

orgSeatReservationSchema.statics.listReservations = async function (
  organizationId,
) {
  return this.find({
    organization: organizationId,
    status: { $in: ["reserved", "claimed"] },
  })
    .sort({ status: 1, email: 1 })
    .lean();
};

orgSeatReservationSchema.statics.createReservation = async function ({
  organization,
  email,
  createdBy,
}) {
  const SeatPool = require("./seatPool.model");
  const normalizedEmail = this.normalizeEmail(email);
  if (!normalizedEmail.includes("@")) {
    throw makeReservationError("A valid email is required.", 400, "INVALID_EMAIL");
  }

  const availability = await SeatPool.getOrgSeatAvailability(organization._id);
  if (availability.totalSeats <= 0) {
    throw makeReservationError(
      "Purchase organization seats before reserving.",
      409,
      "NO_SEATS_AVAILABLE",
      availability,
    );
  }
  if (!availability.canReserve) {
    throw makeReservationError(
      "No seats available to reserve.",
      409,
      "NO_SEATS_AVAILABLE",
      availability,
    );
  }

  const existing = await this.findOne({
    organization: organization._id,
    email: normalizedEmail,
    status: { $in: ["reserved", "claimed"] },
  });

  if (existing) {
    throw makeReservationError(
      "This email already has an active seat reservation.",
      409,
      "ALREADY_RESERVED",
      { reservationId: existing._id, status: existing.status },
    );
  }

  const reservation = new this({
    email: normalizedEmail,
    status: "reserved",
    organization: organization._id,
    createdBy,
    updatedBy: createdBy,
  });

  await reservation.save();
  return reservation;
};

orgSeatReservationSchema.statics.revokeReservation = async function ({
  organization,
  reservationId,
  updatedBy,
}) {
  const reservation = await this.findOne({
    _id: reservationId,
    organization: organization._id,
  });

  if (!reservation) {
    throw makeReservationError("Reservation not found.", 404, "NOT_FOUND");
  }

  if (reservation.status !== "reserved") {
    throw makeReservationError(
      "Only unclaimed reservations can be revoked.",
      400,
      "INVALID_STATUS",
      { status: reservation.status },
    );
  }

  reservation.status = "revoked";
  reservation.updatedBy = updatedBy;
  await reservation.save();
  return reservation;
};

orgSeatReservationSchema.statics.claimReservationAtomically = async function ({
  organizationId,
  email,
  memberId,
  classroomId,
  clerkUserId,
}) {
  const SeatPool = require("./seatPool.model");
  const { PLAN_KEYS } = require("./planCatalog");
  const normalizedEmail = this.normalizeEmail(email);
  if (!normalizedEmail) return null;

  const reservation = await this.findOneAndUpdate(
    {
      organization: organizationId,
      email: normalizedEmail,
      status: "reserved",
    },
    {
      $set: {
        status: "claimed",
        claimedBy: memberId,
        claimedAt: new Date(),
        claimedClassroomId: classroomId,
        updatedBy: clerkUserId,
      },
    },
    { new: true },
  );

  if (!reservation) return null;

  const pool = await SeatPool.findOneAndUpdate(
    {
      organization: organizationId,
      planKey: PLAN_KEYS.ORG_SEATS,
      status: { $in: ACTIVE_POOL_STATUSES },
      $expr: { $lt: ["$usedSeats", "$totalSeats"] },
    },
    {
      $inc: { usedSeats: 1 },
      $set: { updatedBy: clerkUserId },
    },
    { new: true },
  );

  if (!pool) {
    await this.findByIdAndUpdate(reservation._id, {
      $set: {
        status: "reserved",
        updatedBy: clerkUserId,
      },
      $unset: {
        claimedBy: "",
        claimedAt: "",
        claimedClassroomId: "",
      },
    });
    return null;
  }

  return { reservation, pool };
};

orgSeatReservationSchema.statics.reclaimClaimedReservationForMember =
  async function ({ organizationId, memberId, classroomId, clerkUserId }) {
    const SeatPool = require("./seatPool.model");
    const { PLAN_KEYS } = require("./planCatalog");

    const reservation = await this.findOne({
      organization: organizationId,
      claimedBy: memberId,
      status: "claimed",
    });

    if (!reservation) return null;

    const pool = await SeatPool.findOneAndUpdate(
      {
        organization: organizationId,
        planKey: PLAN_KEYS.ORG_SEATS,
        status: { $in: ACTIVE_POOL_STATUSES },
        $expr: { $lt: ["$usedSeats", "$totalSeats"] },
      },
      {
        $inc: { usedSeats: 1 },
        $set: { updatedBy: clerkUserId },
      },
      { new: true },
    );

    if (!pool) return null;

    reservation.claimedClassroomId = classroomId;
    reservation.updatedBy = clerkUserId;
    await reservation.save();

    return { reservation, pool };
  };

const OrgSeatReservation = mongoose.model(
  "OrgSeatReservation",
  orgSeatReservationSchema,
);

module.exports = OrgSeatReservation;
