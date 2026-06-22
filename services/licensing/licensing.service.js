const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const SeatPool = require("./seatPool.model");
const SeatClaim = require("./seatClaim.model");
const RosterSeat = require("./rosterSeat.model");
const {
  getOrgSeatAvailability,
  claimReservationAtomically,
  claimFloatingPrepaidSeatAtomically,
} = require("./orgSeatReservation.service");
const {
  findReusableStudentClaimForJoin,
  repointStudentClaim,
  reclaimOrgReservedForMember,
  countActiveClassroomClaims,
  STUDENT_PAID_SOURCES,
} = require("./seatLifecycle.service");
const { getDefaultFreeTeacherLimits, PLAN_KEYS } = require("./planCatalog");
const {
  assertJoinPolicyAllowed,
  assertRosterAccessAllowed,
} = require("./joinPolicy");

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
  const availability = await getOrgSeatAvailability(organizationId);
  const pool = await SeatPool.findOne({
    organization: organizationId,
    planKey: PLAN_KEYS.ORG_SEATS,
    status: { $in: ACTIVE_POOL_STATUSES },
  }).lean({ virtuals: true });

  return {
    ...availability,
    poolId: pool?._id,
  };
}

async function claimPrepaidSeatAtomically({ organizationId, createdBy }) {
  return claimFloatingPrepaidSeatAtomically({ organizationId, createdBy });
}

async function getBillingSummary({ user, organization }) {
  if (!organization?._id) {
    return {
      seatPools: [],
      classroomUsage: [],
      orgSeatSummary: {
        totalSeats: 0,
        usedSeats: 0,
        reservedUnclaimed: 0,
        floatingAvailable: 0,
        remainingSeats: 0,
      },
      stripePaidSeats: 0,
      freeTeacherLimits: getDefaultFreeTeacherLimits(),
    };
  }

  const [seatPools, claims, classrooms, orgSeatSummary] = await Promise.all([
      SeatPool.find({
        organization: organization._id,
        planKey: PLAN_KEYS.ORG_SEATS,
      })
        .select("-__v")
        .lean({ virtuals: true }),
      SeatClaim.find({
        organization: organization._id,
        status: { $in: ["active", "held"] },
      })
        .select("classroomId userId seatPoolId source status")
        .lean(),
      Classroom.find({ organization: organization._id })
        .select("_id name joinPolicy")
        .lean(),
      getOrgSeatPoolSummary(organization._id),
    ]);

  const activeEnrollments = await Enrollment.find({
    organization: organization._id,
    isRemoved: false,
  })
    .select("classroomId userId")
    .lean();

  const enrolledByClassroom = new Map();
  for (const enrollment of activeEnrollments) {
    const key = String(enrollment.classroomId);
    if (!enrolledByClassroom.has(key)) {
      enrolledByClassroom.set(key, new Set());
    }
    enrolledByClassroom.get(key).add(String(enrollment.userId));
  }

  const classroomUsage = await Promise.all(
    classrooms.map(async (classroom) => {
      const enrolledUsers = enrolledByClassroom.get(String(classroom._id)) || new Set();
      const classroomClaims = claims.filter(
        (claim) =>
          String(claim.classroomId) === String(classroom._id) &&
          claim.status === "active" &&
          enrolledUsers.has(String(claim.userId)),
      );
      return {
        classroomId: classroom._id,
        name: classroom.name,
        joinPolicy: classroom.joinPolicy,
        claimedSeats: classroomClaims.length,
      };
    }),
  );

  const userClaims = user?._id
    ? claims.filter((claim) => String(claim.userId) === String(user._id))
    : [];

  const stripePaidSeats = claims.filter(
    (claim) => STUDENT_PAID_SOURCES.includes(claim.source),
  ).length;

  return {
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
  const [claimedSeats, rosterSeats] = await Promise.all([
    countActiveClassroomClaims(classroomId),
    RosterSeat.find({ classroomId }).lean(),
  ]);

  return {
    claimedSeats,
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
  orgSeatReservationId,
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
    orgSeatReservationId,
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

  const reusableStudentClaim = await findReusableStudentClaimForJoin({
    organizationId: organization._id,
    userId: member._id,
    targetClassroomId: classroom._id,
  });

  if (reusableStudentClaim) {
    const repointed = await repointStudentClaim({
      claim: reusableStudentClaim,
      classroom,
      member,
      rosterSeat,
      updatedBy: clerkUserId,
    });
    return {
      allowed: true,
      claim: repointed,
      decision: "student_reused",
    };
  }

  const reclaimedReservation = await reclaimOrgReservedForMember({
    organizationId: organization._id,
    memberId: member._id,
    classroomId: classroom._id,
    clerkUserId,
  });

  if (reclaimedReservation) {
    return {
      allowed: true,
      ...(await createClaim({
        classroom,
        member,
        source: "org_reserved",
        seatPool: reclaimedReservation.pool,
        rosterSeat,
        orgSeatReservationId: reclaimedReservation.reservation._id,
        createdBy: clerkUserId,
        metadata: { reclaimed: true },
      })),
      decision: "org_reserved_reclaimed",
    };
  }

  if (lookupEmail) {
    const namedClaim = await claimReservationAtomically({
      organizationId: organization._id,
      email: lookupEmail,
      memberId: member._id,
      classroomId: classroom._id,
      clerkUserId,
    });

    if (namedClaim) {
      return {
        allowed: true,
        ...(await createClaim({
          classroom,
          member,
          source: "org_reserved",
          seatPool: namedClaim.pool,
          rosterSeat,
          orgSeatReservationId: namedClaim.reservation._id,
          createdBy: clerkUserId,
        })),
      };
    }
  }

  const prepaidPool = await claimFloatingPrepaidSeatAtomically({
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

const GRANT_SOURCES = ["manual_comp", "teacher_assigned"];

async function grantOrgSeatAndEnroll({
  classroom,
  organization,
  member,
  source = "manual_comp",
  reason = "",
  grantedBy,
}) {
  const grantSource = GRANT_SOURCES.includes(source) ? source : "manual_comp";

  const existingEnrollment = await Enrollment.findByClassAndUser(
    classroom._id,
    member._id
  );
  if (existingEnrollment) {
    throw makeLicensingError(
      "Student is already enrolled in this classroom.",
      409,
      "ALREADY_ENROLLED"
    );
  }

  const existingClaim = await SeatClaim.findActiveClaim(
    classroom._id,
    member._id
  );
  if (existingClaim) {
    const enrollment = await Enrollment.enrollUser(
      classroom._id,
      member._id,
      "member",
      organization._id,
      grantedBy
    );
    return { claim: existingClaim, enrollment, decision: "already_claimed" };
  }

  const prepaidPool = await claimFloatingPrepaidSeatAtomically({
    organizationId: organization._id,
    createdBy: grantedBy,
  });

  if (!prepaidPool) {
    throw makeLicensingError(
      "No organization seats available to grant.",
      409,
      "NO_SEATS_AVAILABLE",
      { organizationId: organization._id }
    );
  }

  const { claim } = await createClaim({
    classroom,
    member,
    source: grantSource,
    seatPool: prepaidPool,
    createdBy: grantedBy,
    metadata: {
      reason: reason || undefined,
      grantedBy,
      grantedAt: new Date().toISOString(),
    },
  });

  const enrollment = await Enrollment.enrollUser(
    classroom._id,
    member._id,
    "member",
    organization._id,
    grantedBy
  );

  return { claim, enrollment, pool: prepaidPool, decision: grantSource };
}

module.exports = {
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
  grantOrgSeatAndEnroll,
};
