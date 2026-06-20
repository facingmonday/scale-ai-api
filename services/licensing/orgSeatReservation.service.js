const OrgSeatReservation = require("./orgSeatReservation.model");
const SeatPool = require("./seatPool.model");
const { PLAN_KEYS } = require("./planCatalog");

const ACTIVE_POOL_STATUSES = ["active", "manual"];

function makeReservationError(message, statusCode, code, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function computeOrgSeatAvailability({
  totalSeats = 0,
  usedSeats = 0,
  reservedUnclaimed = 0,
}) {
  const floatingAvailable = Math.max(
    totalSeats - usedSeats - reservedUnclaimed,
    0
  );
  return {
    totalSeats,
    usedSeats,
    reservedUnclaimed,
    floatingAvailable,
    remainingSeats: floatingAvailable,
    canReserve: floatingAvailable > 0,
  };
}

async function getOrgSeatAvailability(organizationId) {
  const [pool, reservedUnclaimed] = await Promise.all([
    SeatPool.findOne({
      organization: organizationId,
      planKey: PLAN_KEYS.ORG_SEATS,
      status: { $in: ACTIVE_POOL_STATUSES },
    }).lean(),
    OrgSeatReservation.countDocuments({
      organization: organizationId,
      status: "reserved",
    }),
  ]);

  if (!pool) {
    return computeOrgSeatAvailability({ totalSeats: 0, usedSeats: 0, reservedUnclaimed: 0 });
  }

  return computeOrgSeatAvailability({
    totalSeats: pool.totalSeats || 0,
    usedSeats: pool.usedSeats || 0,
    reservedUnclaimed,
  });
}

async function listReservations(organizationId) {
  return OrgSeatReservation.find({
    organization: organizationId,
    status: { $in: ["reserved", "claimed"] },
  })
    .sort({ status: 1, email: 1 })
    .lean();
}

async function createReservation({ organization, email, createdBy }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail.includes("@")) {
    throw makeReservationError("A valid email is required.", 400, "INVALID_EMAIL");
  }

  const availability = await getOrgSeatAvailability(organization._id);
  if (availability.totalSeats <= 0) {
    throw makeReservationError(
      "Purchase organization seats before reserving.",
      409,
      "NO_SEATS_AVAILABLE",
      availability
    );
  }
  if (!availability.canReserve) {
    throw makeReservationError(
      "No seats available to reserve.",
      409,
      "NO_SEATS_AVAILABLE",
      availability
    );
  }

  const existing = await OrgSeatReservation.findOne({
    organization: organization._id,
    email: normalizedEmail,
    status: { $in: ["reserved", "claimed"] },
  });

  if (existing) {
    throw makeReservationError(
      "This email already has an active seat reservation.",
      409,
      "ALREADY_RESERVED",
      { reservationId: existing._id, status: existing.status }
    );
  }

  const reservation = new OrgSeatReservation({
    email: normalizedEmail,
    status: "reserved",
    organization: organization._id,
    createdBy,
    updatedBy: createdBy,
  });

  await reservation.save();
  return reservation;
}

async function revokeReservation({ organization, reservationId, updatedBy }) {
  const reservation = await OrgSeatReservation.findOne({
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
      { status: reservation.status }
    );
  }

  reservation.status = "revoked";
  reservation.updatedBy = updatedBy;
  await reservation.save();
  return reservation;
}

async function claimReservationAtomically({
  organizationId,
  email,
  memberId,
  classroomId,
  clerkUserId,
}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const reservation = await OrgSeatReservation.findOneAndUpdate(
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
    { new: true }
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
    { new: true }
  );

  if (!pool) {
    await OrgSeatReservation.findByIdAndUpdate(reservation._id, {
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
}

async function claimFloatingPrepaidSeatAtomically({ organizationId, createdBy }) {
  const availability = await getOrgSeatAvailability(organizationId);
  if (availability.floatingAvailable <= 0) {
    return null;
  }

  const pool = await SeatPool.findOneAndUpdate(
    {
      organization: organizationId,
      planKey: PLAN_KEYS.ORG_SEATS,
      status: { $in: ACTIVE_POOL_STATUSES },
      $expr: {
        $lt: [
          "$usedSeats",
          { $subtract: ["$totalSeats", availability.reservedUnclaimed] },
        ],
      },
    },
    {
      $inc: { usedSeats: 1 },
      $set: { updatedBy: createdBy },
    },
    { new: true }
  );

  return pool;
}

module.exports = {
  normalizeEmail,
  computeOrgSeatAvailability,
  getOrgSeatAvailability,
  listReservations,
  createReservation,
  revokeReservation,
  claimReservationAtomically,
  claimFloatingPrepaidSeatAtomically,
};
