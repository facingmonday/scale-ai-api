const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const {
  isStudentPaidSource,
  isOrgPaidSource,
  canRepointStudentClaim,
  releaseSeatOnRemoval,
  findReusableStudentClaim,
  repointStudentClaim,
  countActiveClassroomClaims,
} = require("../services/licensing/seatLifecycle.service");
const SeatClaim = require("../services/licensing/seatClaim.model");
const SeatPool = require("../services/licensing/seatPool.model");
const OrgSeatReservation = require("../services/licensing/orgSeatReservation.model");
const Enrollment = require("../services/enrollment/enrollment.model");
const Classroom = require("../services/classroom/classroom.model");
const Member = require("../services/members/member.model");
const { PLAN_KEYS } = require("../services/licensing/planCatalog");
const { transferStudentBetweenClassrooms } = require("../services/enrollment/transfer.service");

async function connectDb() {
  if (mongoose.connection.readyState === 0) {
    let uri = process.env.MONGO_URL || process.env.MONGO_URI;
    if (!uri && process.env.MONGO_SCHEME) {
      uri = `${process.env.MONGO_SCHEME}://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOSTNAME}/${process.env.MONGO_DB}?authSource=admin`;
    }
    if (!uri) {
      uri = "mongodb://localhost:27017/scale-ai-api";
    }
    await mongoose.connect(uri);
  }
}

test("isStudentPaidSource identifies student-paid sources", () => {
  assert.equal(isStudentPaidSource("stripe_student"), true);
  assert.equal(isStudentPaidSource("student_purchase"), true);
  assert.equal(isOrgPaidSource("org_prepaid"), true);
  assert.equal(isOrgPaidSource("org_reserved"), true);
  assert.equal(isStudentPaidSource("org_prepaid"), false);
});

test("canRepointStudentClaim allows held claims regardless of enrollments", () => {
  assert.equal(
    canRepointStudentClaim({
      activeEnrollmentCount: 2,
      claim: { status: "held" },
    }),
    true
  );
});

test("canRepointStudentClaim blocks active orphan repoint when enrolled elsewhere", () => {
  assert.equal(
    canRepointStudentClaim({
      activeEnrollmentCount: 1,
      claim: { status: "active" },
    }),
    false
  );
});

test("canRepointStudentClaim allows active orphan repoint with zero enrollments", () => {
  assert.equal(
    canRepointStudentClaim({
      activeEnrollmentCount: 0,
      claim: { status: "active" },
    }),
    true
  );
});

test("seat lifecycle integration", async (t) => {
  try {
    await connectDb();

    const organizationId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const clerkUserId = "seat_lifecycle_test_user";
    const suffix = Date.now();

    const classroomA = await Classroom.create({
      name: `Seat Lifecycle A ${suffix}`,
      organization: organizationId,
      ownership: new mongoose.Types.ObjectId(),
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const classroomB = await Classroom.create({
      name: `Seat Lifecycle B ${suffix}`,
      organization: organizationId,
      ownership: new mongoose.Types.ObjectId(),
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const pool = await SeatPool.create({
      planKey: PLAN_KEYS.ORG_SEATS,
      scope: "organization",
      purchaserOrganizationId: organizationId,
      totalSeats: 10,
      usedSeats: 0,
      status: "active",
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await t.test("org prepaid remove returns seat to pool", async () => {
      const claim = await SeatClaim.create({
        classroomId: classroomA._id,
        userId,
        seatPoolId: pool._id,
        source: "org_prepaid",
        status: "active",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      pool.usedSeats = 1;
      await pool.save();

      await Enrollment.create({
        classroomId: classroomA._id,
        userId,
        role: "member",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      const result = await releaseSeatOnRemoval({
        classroomId: classroomA._id,
        userId,
        organizationId,
        updatedBy: clerkUserId,
      });

      assert.equal(result.action, "released_to_org");

      const updatedClaim = await SeatClaim.findById(claim._id);
      assert.equal(updatedClaim.status, "revoked");

      const updatedPool = await SeatPool.findById(pool._id);
      assert.equal(updatedPool.usedSeats, 0);
    });

    await t.test("stripe remove holds claim for reuse", async () => {
      const claim = await SeatClaim.create({
        classroomId: classroomA._id,
        userId,
        source: "stripe_student",
        status: "active",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      const result = await releaseSeatOnRemoval({
        classroomId: classroomA._id,
        userId,
        organizationId,
        updatedBy: clerkUserId,
      });

      assert.equal(result.action, "held");

      const updatedClaim = await SeatClaim.findById(claim._id);
      assert.equal(updatedClaim.status, "held");
    });

    await t.test("held claim repoints to another classroom", async () => {
      const heldClaim = await SeatClaim.findOne({
        userId,
        organization: organizationId,
        status: "held",
      });

      const repointed = await repointStudentClaim({
        claim: heldClaim,
        classroom: classroomB,
        member: { _id: userId },
        rosterSeat: null,
        updatedBy: clerkUserId,
      });

      assert.equal(String(repointed.classroomId), String(classroomB._id));
      assert.equal(repointed.status, "active");

      const reusable = await findReusableStudentClaim({
        organizationId,
        userId,
      });
      assert.equal(reusable, null);
    });

    await t.test("org reserved remove keeps reservation claimed and reclaims on rejoin", async () => {
      const orgUserId = new mongoose.Types.ObjectId();
      const reservation = await OrgSeatReservation.create({
        email: `student-${suffix}@example.com`,
        status: "claimed",
        claimedBy: orgUserId,
        claimedAt: new Date(),
        claimedClassroomId: classroomA._id,
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      const orgClaim = await SeatClaim.create({
        classroomId: classroomA._id,
        userId: orgUserId,
        seatPoolId: pool._id,
        orgSeatReservationId: reservation._id,
        source: "org_reserved",
        status: "active",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      pool.usedSeats = 1;
      await pool.save();

      const releaseResult = await releaseSeatOnRemoval({
        classroomId: classroomA._id,
        userId: orgUserId,
        organizationId,
        updatedBy: clerkUserId,
      });

      assert.equal(releaseResult.action, "released_to_org");

      const updatedReservation = await OrgSeatReservation.findById(
        reservation._id
      );
      assert.equal(updatedReservation.status, "claimed");
      assert.equal(updatedReservation.claimedBy.toString(), orgUserId.toString());
      assert.equal(updatedReservation.claimedClassroomId, undefined);

      const updatedPool = await SeatPool.findById(pool._id);
      assert.equal(updatedPool.usedSeats, 0);

      const { reclaimClaimedReservationForMember } = require("../services/licensing/orgSeatReservation.service");
      const reclaimed = await reclaimClaimedReservationForMember({
        organizationId,
        memberId: orgUserId,
        classroomId: classroomB._id,
        clerkUserId,
      });

      assert.ok(reclaimed);
      assert.equal(String(reclaimed.reservation._id), String(reservation._id));

      const finalPool = await SeatPool.findById(pool._id);
      assert.equal(finalPool.usedSeats, 1);

      await SeatClaim.findByIdAndUpdate(orgClaim._id, {
        status: "revoked",
      });
    });

    await t.test("countActiveClassroomClaims ignores claims without enrollment", async () => {
      await SeatClaim.create({
        classroomId: classroomA._id,
        userId: new mongoose.Types.ObjectId(),
        source: "stripe_student",
        status: "active",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      const enrolledUserId = new mongoose.Types.ObjectId();
      await SeatClaim.create({
        classroomId: classroomA._id,
        userId: enrolledUserId,
        source: "org_prepaid",
        status: "active",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });
      await Enrollment.create({
        classroomId: classroomA._id,
        userId: enrolledUserId,
        role: "member",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      const count = await countActiveClassroomClaims(classroomA._id);
      assert.equal(count, 1);
    });

    await t.test("transfer moves claim without changing usedSeats", async () => {
      const transferUserId = new mongoose.Types.ObjectId();
      await Member.create({
        _id: transferUserId,
        clerkUserId: `transfer_${suffix}`,
        email: `transfer-${suffix}@example.com`,
        firstName: "Transfer",
        lastName: "Student",
        organizationMemberships: [],
        createdAt: new Date(),
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      pool.usedSeats = 3;
      await pool.save();

      await Enrollment.create({
        classroomId: classroomA._id,
        userId: transferUserId,
        role: "member",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      await SeatClaim.create({
        classroomId: classroomA._id,
        userId: transferUserId,
        seatPoolId: pool._id,
        source: "org_prepaid",
        status: "active",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      const result = await transferStudentBetweenClassrooms({
        organizationId,
        fromClassroomId: classroomA._id,
        toClassroomId: classroomB._id,
        userId: transferUserId,
        performedByClerkUserId: clerkUserId,
      });

      assert.ok(result.seatClaim);
      assert.equal(String(result.seatClaim.classroomId), String(classroomB._id));

      const poolAfterTransfer = await SeatPool.findById(pool._id);
      assert.equal(poolAfterTransfer.usedSeats, 3);
    });
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
});
