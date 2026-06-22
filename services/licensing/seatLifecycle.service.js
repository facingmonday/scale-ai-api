const Enrollment = require("../enrollment/enrollment.model");
const SeatClaim = require("./seatClaim.model");
const RosterSeat = require("./rosterSeat.model");
const OrgSeatReservation = require("./orgSeatReservation.model");
const {
  releaseUsedSeatAtomically,
  reclaimClaimedReservationForMember,
} = require("./orgSeatReservation.service");

const ORG_PAID_SOURCES = ["org_prepaid", "org_reserved"];
const STUDENT_PAID_SOURCES = ["stripe_student", "student_purchase"];

function getPrimaryEmail(member) {
  return String(member?.email || member?.maskedEmail || "")
    .trim()
    .toLowerCase();
}

function isStudentPaidSource(source) {
  return STUDENT_PAID_SOURCES.includes(source);
}

function isOrgPaidSource(source) {
  if (ORG_PAID_SOURCES.includes(source)) return true;
  if (source === "teacher_assigned" || source === "manual_comp" || source === "enterprise") {
    return true;
  }
  return false;
}

function canRepointStudentClaim({ activeEnrollmentCount, claim }) {
  if (claim.status === "held") return true;
  return activeEnrollmentCount === 0;
}

async function releaseRosterSeatForClaim(claim, updatedBy) {
  if (!claim?.rosterSeatId) return;

  const rosterSeat = await RosterSeat.findById(claim.rosterSeatId);
  if (!rosterSeat) return;

  rosterSeat.status = "reserved";
  rosterSeat.claimedBy = undefined;
  rosterSeat.claimedAt = undefined;
  rosterSeat.updatedBy = updatedBy;
  await rosterSeat.save();
}

async function attachRosterSeatForClaim({ claim, member, classroomId, updatedBy }) {
  const email = getPrimaryEmail(member);
  if (!email) return null;

  const rosterSeat = await RosterSeat.findReservableForEmail(classroomId, email);
  if (!rosterSeat) return null;

  rosterSeat.status = "claimed";
  rosterSeat.claimedBy = member._id;
  rosterSeat.claimedAt = new Date();
  rosterSeat.updatedBy = updatedBy;
  await rosterSeat.save();

  claim.rosterSeatId = rosterSeat._id;
  return rosterSeat;
}

async function holdStudentPaidClaim(claim, updatedBy) {
  await releaseRosterSeatForClaim(claim, updatedBy);

  claim.status = "held";
  claim.updatedBy = updatedBy;
  claim.metadata = {
    ...(claim.metadata || {}),
    heldAt: new Date().toISOString(),
  };
  await claim.save();

  return claim;
}

async function releaseOrgPaidClaim(claim, organizationId, updatedBy) {
  await releaseRosterSeatForClaim(claim, updatedBy);

  claim.status = "revoked";
  claim.updatedBy = updatedBy;
  claim.metadata = {
    ...(claim.metadata || {}),
    releasedAt: new Date().toISOString(),
  };
  await claim.save();

  if (claim.seatPoolId || isOrgPaidSource(claim.source)) {
    await releaseUsedSeatAtomically({ organizationId, updatedBy });
  }

  if (claim.source === "org_reserved") {
    if (claim.orgSeatReservationId) {
      await OrgSeatReservation.findByIdAndUpdate(claim.orgSeatReservationId, {
        $unset: { claimedClassroomId: "" },
        $set: { updatedBy },
      });
    } else {
      await OrgSeatReservation.findOneAndUpdate(
        {
          organization: organizationId,
          claimedBy: claim.userId,
          status: "claimed",
        },
        {
          $unset: { claimedClassroomId: "" },
          $set: { updatedBy },
        }
      );
    }
  }

  return claim;
}

async function releaseSeatOnRemoval({
  classroomId,
  userId,
  organizationId,
  updatedBy,
}) {
  const claim = await SeatClaim.findActiveClaim(classroomId, userId);
  if (!claim) {
    return { action: "none", claim: null };
  }

  if (isStudentPaidSource(claim.source)) {
    const held = await holdStudentPaidClaim(claim, updatedBy);
    return { action: "held", claim: held };
  }

  if (isOrgPaidSource(claim.source)) {
    const released = await releaseOrgPaidClaim(claim, organizationId, updatedBy);
    return { action: "released_to_org", claim: released };
  }

  const released = await releaseOrgPaidClaim(claim, organizationId, updatedBy);
  return { action: "released_to_org", claim: released };
}

async function findReusableStudentClaim({ organizationId, userId }) {
  const held = await SeatClaim.findHeldStudentClaim(organizationId, userId);
  if (held) return held;

  const activeEnrollments = await Enrollment.find({
    userId,
    organization: organizationId,
    isRemoved: false,
  }).select("classroomId");

  if (activeEnrollments.length > 0) return null;

  const orphanActive = await SeatClaim.findOne({
    organization: organizationId,
    userId,
    status: "active",
    source: { $in: STUDENT_PAID_SOURCES },
  }).sort({ claimedAt: -1 });

  return orphanActive;
}

async function getActiveEnrollmentCountForUser(userId, organizationId) {
  return Enrollment.countDocuments({
    userId,
    organization: organizationId,
    isRemoved: false,
  });
}

async function findReusableStudentClaimForJoin({
  organizationId,
  userId,
  targetClassroomId,
}) {
  const activeEnrollmentCount = await getActiveEnrollmentCountForUser(
    userId,
    organizationId
  );

  const claim = await findReusableStudentClaim({ organizationId, userId });
  if (!claim) return null;

  if (
    !canRepointStudentClaim({
      activeEnrollmentCount,
      claim,
    })
  ) {
    return null;
  }

  if (
    String(claim.classroomId) === String(targetClassroomId) &&
    claim.status === "active"
  ) {
    return claim;
  }

  return claim;
}

async function repointStudentClaim({
  claim,
  classroom,
  member,
  rosterSeat,
  updatedBy,
}) {
  if (claim.rosterSeatId) {
    await releaseRosterSeatForClaim(claim, updatedBy);
  }

  claim.classroomId = classroom._id;
  claim.status = "active";
  claim.rosterSeatId = undefined;
  claim.updatedBy = updatedBy;
  claim.metadata = {
    ...(claim.metadata || {}),
    repointedAt: new Date().toISOString(),
    repointedTo: String(classroom._id),
  };

  if (rosterSeat) {
    rosterSeat.status = "claimed";
    rosterSeat.claimedBy = member._id;
    rosterSeat.claimedAt = new Date();
    rosterSeat.updatedBy = updatedBy;
    await rosterSeat.save();
    claim.rosterSeatId = rosterSeat._id;
  } else {
    await attachRosterSeatForClaim({
      claim,
      member,
      classroomId: classroom._id,
      updatedBy,
    });
  }

  await claim.save();
  return claim;
}

async function reclaimOrgReservedForMember({
  organizationId,
  memberId,
  classroomId,
  clerkUserId,
}) {
  const activeClaim = await SeatClaim.findActiveClaim(classroomId, memberId);
  if (activeClaim) return null;

  const activeEnrollmentCount = await getActiveEnrollmentCountForUser(
    memberId,
    organizationId
  );
  if (activeEnrollmentCount > 0) return null;

  return reclaimClaimedReservationForMember({
    organizationId,
    memberId,
    classroomId,
    clerkUserId,
  });
}

async function countActiveClassroomClaims(classroomId) {
  const [claims, enrollments] = await Promise.all([
    SeatClaim.find({ classroomId, status: "active" }).select("userId").lean(),
    Enrollment.find({ classroomId, isRemoved: false }).select("userId").lean(),
  ]);

  const enrolledUserIds = new Set(
    enrollments.map((e) => String(e.userId))
  );

  return claims.filter((claim) => enrolledUserIds.has(String(claim.userId)))
    .length;
}

async function releaseSeatsOnOrgRemoval({ organizationId, userId, updatedBy }) {
  const Member = require("../members/member.model");

  const enrollments = await Enrollment.find({
    userId,
    organization: organizationId,
    isRemoved: false,
  });

  let enrollmentsRemoved = 0;
  let orgSeatsReleased = 0;
  let studentSeatsHeld = 0;

  for (const enrollment of enrollments) {
    await Enrollment.removeEnrollment(
      enrollment.classroomId,
      userId,
      updatedBy
    );
    enrollmentsRemoved += 1;

    const seatRelease = await releaseSeatOnRemoval({
      classroomId: enrollment.classroomId,
      userId,
      organizationId,
      updatedBy,
    });

    if (seatRelease.action === "released_to_org") {
      orgSeatsReleased += 1;
    } else if (seatRelease.action === "held") {
      studentSeatsHeld += 1;
    }
  }

  const activeClaims = await SeatClaim.find({
    organization: organizationId,
    userId,
    status: "active",
  });

  for (const claim of activeClaims) {
    const seatRelease = await releaseSeatOnRemoval({
      classroomId: claim.classroomId,
      userId,
      organizationId,
      updatedBy,
    });

    if (seatRelease.action === "released_to_org") {
      orgSeatsReleased += 1;
    } else if (seatRelease.action === "held") {
      studentSeatsHeld += 1;
    }
  }

  const member = await Member.findById(userId);
  if (member?.activeClassroom?.classroomId) {
    const { clearActiveClassroomForMember } = require("../enrollment/leaveClassroom.service");
    await clearActiveClassroomForMember({
      member,
      classroomId: member.activeClassroom.classroomId,
    });
  }

  const heldCount = await SeatClaim.countDocuments({
    organization: organizationId,
    userId,
    status: "held",
    source: { $in: STUDENT_PAID_SOURCES },
  });

  return {
    enrollmentsRemoved,
    orgSeatsReleased,
    studentSeatsHeld: Math.max(studentSeatsHeld, heldCount),
  };
}

module.exports = {
  ORG_PAID_SOURCES,
  STUDENT_PAID_SOURCES,
  isStudentPaidSource,
  isOrgPaidSource,
  canRepointStudentClaim,
  getPrimaryEmail,
  releaseRosterSeatForClaim,
  attachRosterSeatForClaim,
  holdStudentPaidClaim,
  releaseOrgPaidClaim,
  releaseSeatOnRemoval,
  findReusableStudentClaim,
  findReusableStudentClaimForJoin,
  getActiveEnrollmentCountForUser,
  repointStudentClaim,
  reclaimOrgReservedForMember,
  countActiveClassroomClaims,
  releaseSeatsOnOrgRemoval,
};
