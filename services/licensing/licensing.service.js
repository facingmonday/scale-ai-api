const Classroom = require("../classroom/classroom.model");
const BillingSubscription = require("./billingSubscription.model");
const SeatPool = require("./seatPool.model");
const ClassroomSeatAllocation = require("./classroomSeatAllocation.model");
const SeatClaim = require("./seatClaim.model");
const RosterSeat = require("./rosterSeat.model");
const {
  getDefaultFreeTeacherLimits,
  getPlan,
  PLAN_KEYS,
} = require("./planCatalog");

const ACTIVE_STATUSES = ["active", "trialing", "manual"];

function makeLicensingError(message, statusCode, code, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function getPrimaryEmail(member) {
  return String(member?.email || member?.maskedEmail || "").trim().toLowerCase();
}

async function getBillingSummary({ user, organization }) {
  if (!organization?._id) {
    return {
      plans: [],
      seatPools: [],
      classroomUsage: [],
      freeTeacherLimits: getDefaultFreeTeacherLimits(),
    };
  }

  const [subscriptions, seatPools, claims, classrooms] = await Promise.all([
    BillingSubscription.find({
      organization: organization._id,
      status: { $in: ACTIVE_STATUSES },
    })
      .select("-__v")
      .lean(),
    SeatPool.find({
      organization: organization._id,
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
      .select("_id name billingMode joinPolicy")
      .lean(),
  ]);

  const classroomUsage = classrooms.map((classroom) => {
    const classroomClaims = claims.filter(
      (claim) => String(claim.classroomId) === String(classroom._id)
    );
    return {
      classroomId: classroom._id,
      name: classroom.name,
      billingMode: classroom.billingMode,
      joinPolicy: classroom.joinPolicy,
      claimedSeats: classroomClaims.length,
    };
  });

  const userClaims = user?._id
    ? claims.filter((claim) => String(claim.userId) === String(user._id))
    : [];

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
    freeTeacherLimits: getDefaultFreeTeacherLimits(),
  };
}

async function canCreateClassroom({ organization }) {
  const freeLimits = getDefaultFreeTeacherLimits();
  const activeClassrooms = await Classroom.countDocuments({
    organization: organization._id,
    isActive: true,
  });

  const enterprisePool = await SeatPool.findOne({
    organization: organization._id,
    planKey: PLAN_KEYS.INSTITUTION_ENTERPRISE,
    status: { $in: ["active", "manual"] },
  });

  if (enterprisePool) {
    return { allowed: true, reason: "enterprise" };
  }

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
      decision
    );
  }
  return decision;
}

async function getClassroomSeatSummary(classroomId) {
  const [allocations, claims, rosterSeats] = await Promise.all([
    ClassroomSeatAllocation.find({ classroomId, status: "active" })
      .populate("seatPoolId")
      .lean({ virtuals: true }),
    SeatClaim.find({ classroomId, status: "active" }).lean(),
    RosterSeat.find({ classroomId }).lean(),
  ]);

  return {
    allocations: allocations.map((allocation) => ({
      ...allocation,
      remainingSeats: Math.max(
        (allocation.seatsAllocated || 0) - (allocation.seatsClaimed || 0),
        0
      ),
    })),
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

async function findOpenAllocation(classroomId) {
  const allocations = await ClassroomSeatAllocation.find({
    classroomId,
    status: "active",
    mode: { $in: ["open", "invite_only"] },
  })
    .sort({ createdDate: 1 })
    .populate("seatPoolId");

  return allocations.find((allocation) => {
    const pool = allocation.seatPoolId;
    if (!pool || !["active", "manual"].includes(pool.status)) return false;
    const remaining = (allocation.seatsAllocated || 0) - (allocation.seatsClaimed || 0);
    return remaining > 0 || pool.totalSeats === null;
  });
}

async function findUnclaimedStudentPool({ organizationId, memberId }) {
  const userPools = await SeatPool.find({
    organization: organizationId,
    purchaserUserId: memberId,
    planKey: PLAN_KEYS.STUDENT_CLASS_PASS,
    status: { $in: ["active", "manual"] },
  }).sort({ createdDate: 1 });

  return userPools.find((pool) => {
    if (pool.totalSeats === null) return true;
    return (pool.usedSeats || 0) < (pool.totalSeats || 0);
  });
}

async function createClaim({
  classroom,
  member,
  source,
  seatPool,
  allocation,
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
    allocationId: allocation?._id,
    rosterSeatId: rosterSeat?._id,
    source,
    organization: classroom.organization,
    createdBy,
    updatedBy: createdBy,
    metadata,
  });

  await claim.save();

  if (seatPool && seatPool.totalSeats !== null) {
    seatPool.usedSeats = (seatPool.usedSeats || 0) + 1;
    seatPool.updatedBy = createdBy;
    await seatPool.save();
  }

  if (allocation) {
    allocation.seatsClaimed = (allocation.seatsClaimed || 0) + 1;
    allocation.updatedBy = createdBy;
    await allocation.save();
  }

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
}) {
  const existing = await SeatClaim.findActiveClaim(classroom._id, member._id);
  if (existing) return { allowed: true, claim: existing, decision: "already_claimed" };

  const billingMode = classroom.billingMode || "student_paid";
  const joinPolicy = classroom.joinPolicy || "invite_link";
  
  const lookupEmail = studentEmail || getPrimaryEmail(member);
  let rosterSeat = null;

  if (lookupEmail) {
    rosterSeat = await RosterSeat.findReservableForEmail(classroom._id, lookupEmail);
  }

  if (!rosterSeat && studentId) {
    rosterSeat = await RosterSeat.findOne({
      classroomId: classroom._id,
      studentId: studentId.trim(),
      status: "reserved",
    });
  }

  if (rosterSeat) {
    if (studentEmail && rosterSeat.email !== studentEmail) {
      rosterSeat.email = studentEmail;
    }
    const allocation = rosterSeat.allocationId
      ? await ClassroomSeatAllocation.findById(rosterSeat.allocationId).populate(
          "seatPoolId"
        )
      : null;
    return {
      allowed: true,
      ...(await createClaim({
        classroom,
        member,
        source: "roster_reserved",
        seatPool: allocation?.seatPoolId,
        allocation,
        rosterSeat,
        createdBy: clerkUserId,
      })),
    };
  }

  if (classroom.allowAnonymousJoin === false) {
    throw makeLicensingError(
      "This classroom is limited to imported roster students.",
      403,
      "ROSTER_ONLY",
      { classroomId: classroom._id, organizationId: organization._id }
    );
  }

  if (joinPolicy === "roster_only" || billingMode === "roster_only") {
    throw makeLicensingError(
      "This classroom is limited to imported roster emails.",
      403,
      "ROSTER_ONLY",
      { classroomId: classroom._id, organizationId: organization._id }
    );
  }

  if (["teacher_paid_open", "hybrid"].includes(billingMode)) {
    const allocation = await findOpenAllocation(classroom._id);
    if (allocation) {
      return {
        allowed: true,
        ...(await createClaim({
          classroom,
          member,
          source: "teacher_open",
          seatPool: allocation.seatPoolId,
          allocation,
          createdBy: clerkUserId,
        })),
      };
    }
  }

  const userPool = await findUnclaimedStudentPool({
    organizationId: organization._id,
    memberId: member._id,
  });

  if (userPool) {
    return {
      allowed: true,
      ...(await createClaim({
        classroom,
        member,
        source: "student_purchase",
        seatPool: userPool,
        createdBy: clerkUserId,
      })),
    };
  }

  if (billingMode === "open_free") {
    return {
      allowed: true,
      ...(await createClaim({
        classroom,
        member,
        source: "free_teacher_workspace",
        createdBy: clerkUserId,
      })),
    };
  }

  if (classroom.studentPaysAllowed !== false) {
    throw makeLicensingError(
      "Payment is required to join this classroom.",
      402,
      "PAYMENT_REQUIRED",
      {
        classroomId: classroom._id,
        organizationId: organization._id,
        planKey: PLAN_KEYS.STUDENT_CLASS_PASS,
      }
    );
  }

  throw makeLicensingError(
    "No classroom seats are currently available.",
    403,
    "NO_SEATS_AVAILABLE",
    { classroomId: classroom._id, organizationId: organization._id }
  );
}

async function createManualSeatPool({
  organization,
  purchaserUserId,
  planKey,
  totalSeats,
  createdBy,
}) {
  const plan = getPlan(planKey);
  const seats = totalSeats ?? plan?.seatCount ?? 1;
  const pool = new SeatPool({
    planKey,
    scope: plan?.seatPoolScope || "organization",
    purchaserUserId,
    purchaserOrganizationId: organization._id,
    totalSeats: seats,
    status: "manual",
    organization: organization._id,
    createdBy,
    updatedBy: createdBy,
    metadata: {
      source: "manual_or_pending_clerk_billing",
    },
  });
  await pool.save();
  return pool;
}

async function allocateSeatsToClassroom({
  classroom,
  seatPoolId,
  seatsAllocated,
  mode = "open",
  createdBy,
}) {
  const seatPool = await SeatPool.findById(seatPoolId);
  if (!seatPool) {
    throw makeLicensingError("Seat pool not found", 404, "SEAT_POOL_NOT_FOUND");
  }

  const alreadyAllocated = await ClassroomSeatAllocation.aggregate([
    {
      $match: {
        seatPoolId: seatPool._id,
        status: "active",
      },
    },
    {
      $group: {
        _id: null,
        seatsAllocated: { $sum: "$seatsAllocated" },
      },
    },
  ]);

  const allocated = alreadyAllocated?.[0]?.seatsAllocated || 0;
  if (
    seatPool.totalSeats !== null &&
    allocated + Number(seatsAllocated || 0) > seatPool.totalSeats
  ) {
    throw makeLicensingError(
      "Seat allocation exceeds the selected seat pool.",
      400,
      "SEAT_POOL_EXCEEDED",
      {
        totalSeats: seatPool.totalSeats,
        alreadyAllocated: allocated,
      }
    );
  }

  const allocation = new ClassroomSeatAllocation({
    classroomId: classroom._id,
    seatPoolId: seatPool._id,
    seatsAllocated,
    mode,
    organization: classroom.organization,
    createdBy,
    updatedBy: createdBy,
  });
  await allocation.save();
  return allocation;
}

module.exports = {
  ACTIVE_STATUSES,
  makeLicensingError,
  getBillingSummary,
  canCreateClassroom,
  requireCanCreateClassroom,
  getClassroomSeatSummary,
  claimSeatOrRequireCheckout,
  createManualSeatPool,
  allocateSeatsToClassroom,
};
