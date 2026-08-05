const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const { PLAN_KEYS, getDefaultFreeTeacherLimits } = require("./planCatalog");
const { makeLicensingError } = require("./licensing.errors");

const ACTIVE_POOL_STATUSES = ["active", "manual"];

const seatPoolSchema = new mongoose.Schema({
  planKey: {
    type: String,
    required: true,
    index: true,
  },
  scope: {
    type: String,
    enum: ["user", "teacher", "organization"],
    required: true,
    index: true,
  },
  purchaserUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    index: true,
  },
  purchaserOrganizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    index: true,
  },
  totalSeats: {
    type: Number,
    default: 1,
  },
  usedSeats: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "past_due", "canceled", "expired", "manual"],
    default: "active",
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}).add(baseSchema);

seatPoolSchema.virtual("remainingSeats").get(function () {
  if (this.totalSeats === null || this.totalSeats === undefined) return null;
  return Math.max(this.totalSeats - (this.usedSeats || 0), 0);
});

seatPoolSchema.statics.findActiveForOrganization = function (organizationId) {
  return this.find({
    organization: organizationId,
    status: { $in: ACTIVE_POOL_STATUSES },
  });
};

seatPoolSchema.statics.findActiveForUser = function (organizationId, userId) {
  return this.find({
    organization: organizationId,
    purchaserUserId: userId,
    status: { $in: ACTIVE_POOL_STATUSES },
  });
};

seatPoolSchema.statics.computeOrgSeatAvailability = function ({
  totalSeats = 0,
  usedSeats = 0,
  reservedUnclaimed = 0,
}) {
  const floatingAvailable = Math.max(
    totalSeats - usedSeats - reservedUnclaimed,
    0,
  );
  return {
    totalSeats,
    usedSeats,
    reservedUnclaimed,
    floatingAvailable,
    remainingSeats: floatingAvailable,
    canReserve: floatingAvailable > 0,
  };
};

seatPoolSchema.statics.getOrgSeatAvailability = async function (organizationId) {
  const OrgSeatReservation = require("./orgSeatReservation.model");
  const [pool, reservedUnclaimed] = await Promise.all([
    this.findOne({
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
    return this.computeOrgSeatAvailability({
      totalSeats: 0,
      usedSeats: 0,
      reservedUnclaimed: 0,
    });
  }

  return this.computeOrgSeatAvailability({
    totalSeats: pool.totalSeats || 0,
    usedSeats: pool.usedSeats || 0,
    reservedUnclaimed,
  });
};

seatPoolSchema.statics.findOrCreateOrgSeatPool = async function (
  organization,
  createdBy = "system",
) {
  const orgId = organization._id || organization;
  let pool = await this.findOne({
    organization: orgId,
    planKey: PLAN_KEYS.ORG_SEATS,
    status: { $in: ACTIVE_POOL_STATUSES },
  });

  if (!pool) {
    pool = new this({
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
};

seatPoolSchema.statics.getOrgSeatPoolSummary = async function (organizationId) {
  const availability = await this.getOrgSeatAvailability(organizationId);
  const pool = await this.findOne({
    organization: organizationId,
    planKey: PLAN_KEYS.ORG_SEATS,
    status: { $in: ACTIVE_POOL_STATUSES },
  }).lean({ virtuals: true });

  return {
    ...availability,
    poolId: pool?._id,
  };
};

seatPoolSchema.statics.claimPrepaidSeatAtomically = async function ({
  organizationId,
  createdBy,
}) {
  return this.claimFloatingPrepaidSeatAtomically({ organizationId, createdBy });
};

seatPoolSchema.statics.releaseUsedSeatAtomically = async function ({
  organizationId,
  updatedBy,
}) {
  const pool = await this.findOneAndUpdate(
    {
      organization: organizationId,
      planKey: PLAN_KEYS.ORG_SEATS,
      status: { $in: ACTIVE_POOL_STATUSES },
      usedSeats: { $gt: 0 },
    },
    {
      $inc: { usedSeats: -1 },
      $set: { updatedBy },
    },
    { new: true },
  );

  return pool;
};

seatPoolSchema.statics.claimFloatingPrepaidSeatAtomically = async function ({
  organizationId,
  createdBy,
}) {
  const availability = await this.getOrgSeatAvailability(organizationId);
  if (availability.floatingAvailable <= 0) {
    return null;
  }

  const pool = await this.findOneAndUpdate(
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
    { new: true },
  );

  return pool;
};

seatPoolSchema.statics.getBillingSummary = async function ({ user, organization }) {
  const SeatClaim = require("./seatClaim.model");
  const Classroom = require("../classroom/classroom.model");
  const Enrollment = require("../enrollment/enrollment.model");

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
    this.find({
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
    this.getOrgSeatPoolSummary(organization._id),
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
      const enrolledUsers =
        enrolledByClassroom.get(String(classroom._id)) || new Set();
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

  const stripePaidSeats = claims.filter((claim) =>
    SeatClaim.isStudentPaidSource(claim.source),
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
};

const SeatPool = mongoose.model("SeatPool", seatPoolSchema);

module.exports = SeatPool;
