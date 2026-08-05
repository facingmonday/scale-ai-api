const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const { PLAN_KEYS } = require("./planCatalog");
const { makeLicensingError } = require("./licensing.errors");
const {
  assertJoinPolicyAllowed,
  assertRosterAccessAllowed,
} = require("./joinPolicy");

const ORG_PAID_SOURCES = ["org_prepaid", "org_reserved"];
const STUDENT_PAID_SOURCES = ["stripe_student", "student_purchase"];
const GRANT_SOURCES = ["manual_comp", "teacher_assigned"];

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
    enum: ["active", "held", "revoked", "expired"],
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
  },
);
seatClaimSchema.index({ organization: 1, classroomId: 1, status: 1 });

seatClaimSchema.statics.ORG_PAID_SOURCES = ORG_PAID_SOURCES;
seatClaimSchema.statics.STUDENT_PAID_SOURCES = STUDENT_PAID_SOURCES;

seatClaimSchema.statics.getPrimaryEmail = function (member) {
  return String(member?.email || member?.maskedEmail || "")
    .trim()
    .toLowerCase();
};

seatClaimSchema.statics.isStudentPaidSource = function (source) {
  return STUDENT_PAID_SOURCES.includes(source);
};

seatClaimSchema.statics.isOrgPaidSource = function (source) {
  if (ORG_PAID_SOURCES.includes(source)) return true;
  if (
    source === "teacher_assigned" ||
    source === "manual_comp" ||
    source === "enterprise"
  ) {
    return true;
  }
  return false;
};

seatClaimSchema.statics.canRepointStudentClaim = function ({
  activeEnrollmentCount,
  claim,
}) {
  if (claim.status === "held") return true;
  return activeEnrollmentCount === 0;
};

seatClaimSchema.statics.findActiveClaim = function (classroomId, userId) {
  return this.findOne({
    classroomId,
    userId,
    status: "active",
  });
};

seatClaimSchema.statics.findHeldStudentClaim = function (
  organizationId,
  userId,
) {
  return this.findOne({
    organization: organizationId,
    userId,
    status: "held",
    source: { $in: STUDENT_PAID_SOURCES },
  }).sort({ claimedAt: -1 });
};

seatClaimSchema.statics.holdStudentPaidClaim = async function (
  claim,
  updatedBy,
) {
  const RosterSeat = require("./rosterSeat.model");
  await RosterSeat.releaseForClaim(claim, updatedBy);

  claim.status = "held";
  claim.updatedBy = updatedBy;
  claim.metadata = {
    ...(claim.metadata || {}),
    heldAt: new Date().toISOString(),
  };
  await claim.save();

  return claim;
};

seatClaimSchema.statics.releaseOrgPaidClaim = async function (
  claim,
  organizationId,
  updatedBy,
) {
  const RosterSeat = require("./rosterSeat.model");
  const OrgSeatReservation = require("./orgSeatReservation.model");
  const SeatPool = require("./seatPool.model");

  await RosterSeat.releaseForClaim(claim, updatedBy);

  claim.status = "revoked";
  claim.updatedBy = updatedBy;
  claim.metadata = {
    ...(claim.metadata || {}),
    releasedAt: new Date().toISOString(),
  };
  await claim.save();

  if (claim.seatPoolId || this.isOrgPaidSource(claim.source)) {
    await SeatPool.releaseUsedSeatAtomically({ organizationId, updatedBy });
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
        },
      );
    }
  }

  return claim;
};

seatClaimSchema.statics.releaseSeatOnRemoval = async function ({
  classroomId,
  userId,
  organizationId,
  updatedBy,
}) {
  const claim = await this.findActiveClaim(classroomId, userId);
  if (!claim) {
    return { action: "none", claim: null };
  }

  if (this.isStudentPaidSource(claim.source)) {
    const held = await this.holdStudentPaidClaim(claim, updatedBy);
    return { action: "held", claim: held };
  }

  const released = await this.releaseOrgPaidClaim(
    claim,
    organizationId,
    updatedBy,
  );
  return { action: "released_to_org", claim: released };
};

seatClaimSchema.statics.findReusableStudentClaim = async function ({
  organizationId,
  userId,
}) {
  const Enrollment = require("../enrollment/enrollment.model");
  const held = await this.findHeldStudentClaim(organizationId, userId);
  if (held) return held;

  const activeEnrollments = await Enrollment.find({
    userId,
    organization: organizationId,
    isRemoved: false,
  }).select("classroomId");

  if (activeEnrollments.length > 0) return null;

  const orphanActive = await this.findOne({
    organization: organizationId,
    userId,
    status: "active",
    source: { $in: STUDENT_PAID_SOURCES },
  }).sort({ claimedAt: -1 });

  return orphanActive;
};

seatClaimSchema.statics.findReusableStudentClaimForJoin = async function ({
  organizationId,
  userId,
  targetClassroomId,
}) {
  const Enrollment = require("../enrollment/enrollment.model");
  const activeEnrollmentCount =
    await Enrollment.getActiveEnrollmentCountForUser(userId, organizationId);

  const claim = await this.findReusableStudentClaim({
    organizationId,
    userId,
  });
  if (!claim) return null;

  if (
    !this.canRepointStudentClaim({
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
};

seatClaimSchema.statics.repointStudentClaim = async function ({
  claim,
  classroom,
  member,
  rosterSeat,
  updatedBy,
}) {
  const RosterSeat = require("./rosterSeat.model");

  if (claim.rosterSeatId) {
    await RosterSeat.releaseForClaim(claim, updatedBy);
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
    await RosterSeat.attachForClaim({
      claim,
      member,
      classroomId: classroom._id,
      updatedBy,
    });
  }

  await claim.save();
  return claim;
};

seatClaimSchema.statics.reclaimOrgReservedForMember = async function ({
  organizationId,
  memberId,
  classroomId,
  clerkUserId,
}) {
  const Enrollment = require("../enrollment/enrollment.model");
  const OrgSeatReservation = require("./orgSeatReservation.model");

  const activeClaim = await this.findActiveClaim(classroomId, memberId);
  if (activeClaim) return null;

  const activeEnrollmentCount =
    await Enrollment.getActiveEnrollmentCountForUser(memberId, organizationId);
  if (activeEnrollmentCount > 0) return null;

  return OrgSeatReservation.reclaimClaimedReservationForMember({
    organizationId,
    memberId,
    classroomId,
    clerkUserId,
  });
};

seatClaimSchema.statics.countActiveClassroomClaims = async function (
  classroomId,
) {
  const Enrollment = require("../enrollment/enrollment.model");
  const [claims, enrollments] = await Promise.all([
    this.find({ classroomId, status: "active" }).select("userId").lean(),
    Enrollment.find({ classroomId, isRemoved: false }).select("userId").lean(),
  ]);

  const enrolledUserIds = new Set(
    enrollments.map((e) => String(e.userId)),
  );

  return claims.filter((claim) => enrolledUserIds.has(String(claim.userId)))
    .length;
};

seatClaimSchema.statics.createClaim = async function ({
  classroom,
  member,
  source,
  seatPool,
  rosterSeat,
  orgSeatReservationId,
  createdBy,
  metadata = {},
}) {
  const existing = await this.findActiveClaim(classroom._id, member._id);
  if (existing) {
    return { claim: existing, decision: "already_claimed" };
  }

  const claim = new this({
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
};

seatClaimSchema.statics.claimSeatOrRequireCheckout = async function ({
  classroom,
  organization,
  member,
  clerkUserId,
  studentEmail,
  studentId,
  joinSource = "invite_link",
}) {
  const RosterSeat = require("./rosterSeat.model");
  const OrgSeatReservation = require("./orgSeatReservation.model");
  const SeatPool = require("./seatPool.model");

  const existing = await this.findActiveClaim(classroom._id, member._id);
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

  const lookupEmail = studentEmail || this.getPrimaryEmail(member);
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

  const reusableStudentClaim = await this.findReusableStudentClaimForJoin({
    organizationId: organization._id,
    userId: member._id,
    targetClassroomId: classroom._id,
  });

  if (reusableStudentClaim) {
    const repointed = await this.repointStudentClaim({
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

  const reclaimedReservation = await this.reclaimOrgReservedForMember({
    organizationId: organization._id,
    memberId: member._id,
    classroomId: classroom._id,
    clerkUserId,
  });

  if (reclaimedReservation) {
    return {
      allowed: true,
      ...(await this.createClaim({
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
    const namedClaim = await OrgSeatReservation.claimReservationAtomically({
      organizationId: organization._id,
      email: lookupEmail,
      memberId: member._id,
      classroomId: classroom._id,
      clerkUserId,
    });

    if (namedClaim) {
      return {
        allowed: true,
        ...(await this.createClaim({
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

  const prepaidPool = await SeatPool.claimFloatingPrepaidSeatAtomically({
    organizationId: organization._id,
    createdBy: clerkUserId,
  });

  if (prepaidPool) {
    return {
      allowed: true,
      ...(await this.createClaim({
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
};

const SeatClaim = mongoose.model("SeatClaim", seatClaimSchema);

module.exports = SeatClaim;
