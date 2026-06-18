const Classroom = require("../classroom/classroom.model");
const BillingSubscription = require("./billingSubscription.model");
const SeatPool = require("./seatPool.model");
const SeatClaim = require("./seatClaim.model");
const RosterSeat = require("./rosterSeat.model");
const { getDefaultFreeTeacherLimits, PLAN_KEYS } = require("./planCatalog");
const {
  assertJoinPolicyAllowed,
  assertRosterAccessAllowed,
} = require("./joinPolicy");

const ACTIVE_STATUSES = ["active", "trialing", "manual"];
const ACTIVE_POOL_STATUSES = ["active", "manual"];

function makeLicensingError(message, statusCode, code, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function getPrimaryEmail(member) {
  return String(member?.email || member?.maskedEmail || "")
    .trim()
    .toLowerCase();
}

async function findOrCreateOrgSeatPool(organization, createdBy = "system") {
  const orgId = organization._id || organization;
  let pool = await SeatPool.findOne({
    organization: orgId,
    planKey: PLAN_KEYS.ORG_SEATS,
    status: { $in: ACTIVE_POOL_STATUSES },
  });

  if (!pool) {
    pool = new SeatPool({
      planKey: PLAN_KEYS.ORG_SEATS,
      scope: "organization",
      purchaserOrganizationId: orgId,
      totalSeats: 0,
      usedSeats: 0,
      status: "active",
      organization: orgId,
      createdBy,
      updatedBy: createdBy,
      metadata: { source: "org_seat_pool" },
    });
    await pool.save();
  }

  return pool;
}

async function getOrgSeatPoolSummary(organizationId) {
  const pool = await SeatPool.findOne({
    organization: organizationId,
    planKey: PLAN_KEYS.ORG_SEATS,
    status: { $in: ACTIVE_POOL_STATUSES },
  }).lean({ virtuals: true });

  if (!pool) {
    return {
      totalSeats: 0,
      usedSeats: 0,
      remainingSeats: 0,
    };
  }

  return {
    totalSeats: pool.totalSeats || 0,
    usedSeats: pool.usedSeats || 0,
    remainingSeats: Math.max((pool.totalSeats || 0) - (pool.usedSeats || 0), 0),
    poolId: pool._id,
  };
}

async function claimPrepaidSeatAtomically({ organizationId, createdBy }) {
  const pool = await SeatPool.findOneAndUpdate(
    {
      organization: organizationId,
      planKey: PLAN_KEYS.ORG_SEATS,
      status: { $in: ACTIVE_POOL_STATUSES },
      $expr: { $lt: ["$usedSeats", "$totalSeats"] },
    },
    {
      $inc: { usedSeats: 1 },
      $set: { updatedBy: createdBy },
    },
    { new: true },
  );

  return pool;
}

async function getBillingSummary({ user, organization }) {
  if (!organization?._id) {
    return {
      plans: [],
      seatPools: [],
      classroomUsage: [],
      orgSeatSummary: { totalSeats: 0, usedSeats: 0, remainingSeats: 0 },
      stripePaidSeats: 0,
      freeTeacherLimits: getDefaultFreeTeacherLimits(),
    };
  }

  const [subscriptions, seatPools, claims, classrooms, orgSeatSummary] =
    await Promise.all([
      BillingSubscription.find({
        organization: organization._id,
        status: { $in: ACTIVE_STATUSES },
      })
        .select("-__v")
        .lean(),
      SeatPool.find({
        organization: organization._id,
        planKey: PLAN_KEYS.ORG_SEATS,
      })
        .select("-__v")
        .lean({ virtuals: true }),
      SeatClaim.find({
        organization: organization._id,
        status: "active",
      })
        .select("classroomId userId seatPoolId source")
        .lean(),
      Classroom.find({ organization: organization._id })
        .select("_id name joinPolicy")
        .lean(),
      getOrgSeatPoolSummary(organization._id),
    ]);

  const classroomUsage = classrooms.map((classroom) => {
    const classroomClaims = claims.filter(
      (claim) => String(claim.classroomId) === String(classroom._id),
    );
    return {
      classroomId: classroom._id,
      name: classroom.name,
      joinPolicy: classroom.joinPolicy,
      claimedSeats: classroomClaims.length,
    };
  });

  const userClaims = user?._id
    ? claims.filter((claim) => String(claim.userId) === String(user._id))
    : [];

  const stripePaidSeats = claims.filter(
    (claim) => claim.source === "stripe_student",
  ).length;

  return {
    plans: subscriptions,
    seatPools: seatPools.map((pool) => ({
      ...pool,
      remainingSeats:
        pool.totalSeats === null || pool.totalSeats === undefined
          ? null
          : Math.max((pool.totalSeats || 0) - (pool.usedSeats || 0), 0),
    })),
    classroomUsage,
    userClaims,
    orgSeatSummary,
    stripePaidSeats,
    freeTeacherLimits: getDefaultFreeTeacherLimits(),
  };
}

async function canCreateClassroom({ organization }) {
  const freeLimits = getDefaultFreeTeacherLimits();
  const activeClassrooms = await Classroom.countDocuments({
    organization: organization._id,
    isActive: true,
  });

  if (activeClassrooms >= freeLimits.classroomLimit) {
    return {
      allowed: false,
      reason: "free_classroom_limit_reached",
      limit: freeLimits.classroomLimit,
      activeClassrooms,
    };
  }

  return {
    allowed: true,
    reason: "free_teacher_workspace",
    limit: freeLimits.classroomLimit,
    activeClassrooms,
  };
}

async function requireCanCreateClassroom({ organization }) {
  const decision = await canCreateClassroom({ organization });
  if (!decision.allowed) {
    throw makeLicensingError(
      "Your free classroom limit has been reached. Buy seats or contact support to add more classrooms.",
      402,
      "CLASSROOM_LIMIT_REACHED",
      decision,
    );
  }
  return decision;
}

async function getClassroomSeatSummary(classroomId) {
  const [claims, rosterSeats] = await Promise.all([
    SeatClaim.find({ classroomId, status: "active" }).lean(),
    RosterSeat.find({ classroomId }).lean(),
  ]);

  return {
    claimedSeats: claims.length,
    roster: {
      total: rosterSeats.length,
      reserved: rosterSeats.filter((seat) => seat.status === "reserved").length,
      claimed: rosterSeats.filter((seat) => seat.status === "claimed").length,
      revoked: rosterSeats.filter((seat) => seat.status === "revoked").length,
      invalid: rosterSeats.filter((seat) => seat.status === "invalid").length,
    },
  };
}

async function createClaim({
  classroom,
  member,
  source,
  seatPool,
  rosterSeat,
  createdBy,
  metadata = {},
}) {
  const existing = await SeatClaim.findActiveClaim(classroom._id, member._id);
  if (existing) {
    return { claim: existing, decision: "already_claimed" };
  }

  const claim = new SeatClaim({
    classroomId: classroom._id,
    userId: member._id,
    seatPoolId: seatPool?._id,
    rosterSeatId: rosterSeat?._id,
    source,
    organization: classroom.organization,
    createdBy,
    updatedBy: createdBy,
    metadata,
  });

  await claim.save();

  if (rosterSeat) {
    rosterSeat.status = "claimed";
    rosterSeat.claimedBy = member._id;
    rosterSeat.claimedAt = new Date();
    rosterSeat.updatedBy = createdBy;
    await rosterSeat.save();
  }

  return { claim, decision: source };
}

async function claimSeatOrRequireCheckout({
  classroom,
  organization,
  member,
  clerkUserId,
  studentEmail,
  studentId,
  joinSource = "invite_link",
}) {
  const existing = await SeatClaim.findActiveClaim(classroom._id, member._id);
  if (existing) {
    return { allowed: true, claim: existing, decision: "already_claimed" };
  }

  const joinPolicy = classroom.joinPolicy || "invite_link";

  assertJoinPolicyAllowed({
    classroom,
    organization,
    joinPolicy,
    joinSource,
  });

  const lookupEmail = studentEmail || getPrimaryEmail(member);
  let rosterSeat = null;

  if (lookupEmail) {
    rosterSeat = await RosterSeat.findReservableForEmail(
      classroom._id,
      lookupEmail,
    );
  }

  if (!rosterSeat && studentId) {
    rosterSeat = await RosterSeat.findOne({
      classroomId: classroom._id,
      studentId: studentId.trim(),
      status: "reserved",
    });
  }

  assertRosterAccessAllowed({
    classroom,
    rosterSeat,
    joinPolicy,
  });

  const prepaidPool = await claimPrepaidSeatAtomically({
    organizationId: organization._id,
    createdBy: clerkUserId,
  });

  if (prepaidPool) {
    return {
      allowed: true,
      ...(await createClaim({
        classroom,
        member,
        source: "org_prepaid",
        seatPool: prepaidPool,
        rosterSeat,
        createdBy: clerkUserId,
      })),
    };
  }

  throw makeLicensingError(
    "Payment is required to join this classroom.",
    402,
    "PAYMENT_REQUIRED",
    {
      classroomId: classroom._id,
      organizationId: organization._id,
      planKey: PLAN_KEYS.STUDENT_CLASS_PASS,
    },
  );
}

module.exports = {
  ACTIVE_STATUSES,
  makeLicensingError,
  findOrCreateOrgSeatPool,
  getOrgSeatPoolSummary,
  claimPrepaidSeatAtomically,
  getBillingSummary,
  canCreateClassroom,
  requireCanCreateClassroom,
  getClassroomSeatSummary,
  claimSeatOrRequireCheckout,
  createClaim,
};
