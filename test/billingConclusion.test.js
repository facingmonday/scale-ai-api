const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const { leaveClassroom } = require("../services/enrollment/leaveClassroom.service");
const {
  releaseSeatsOnOrgRemoval,
} = require("../services/licensing/seatLifecycle.service");
const { grantOrgSeatAndEnroll } = require("../services/licensing/licensing.service");
const SeatClaim = require("../services/licensing/seatClaim.model");
const SeatPool = require("../services/licensing/seatPool.model");
const Enrollment = require("../services/enrollment/enrollment.model");
const Classroom = require("../services/classroom/classroom.model");
const Member = require("../services/members/member.model");
const Organization = require("../services/organizations/organization.model");
const { PLAN_KEYS } = require("../services/licensing/planCatalog");

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

test("billing conclusion features", async (t) => {
  try {
    await connectDb();

    const organizationId = new mongoose.Types.ObjectId();
    const suffix = Date.now();
    const clerkUserId = `billing_conclusion_${suffix}`;

    await Organization.create({
      _id: organizationId,
      clerkOrganizationId: `org_${suffix}`,
      name: `Billing Org ${suffix}`,
      slug: `billing-org-${suffix}`,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const classroomA = await Classroom.create({
      name: `Billing A ${suffix}`,
      organization: organizationId,
      ownership: new mongoose.Types.ObjectId(),
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const classroomB = await Classroom.create({
      name: `Billing B ${suffix}`,
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

    await t.test("leaveClassroom returns org seat to pool", async () => {
      const userId = new mongoose.Types.ObjectId();

      await SeatClaim.create({
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

      const result = await leaveClassroom({
        classroomId: classroomA._id,
        userId,
        organizationId,
        updatedBy: clerkUserId,
      });

      assert.equal(result.seatRelease.action, "released_to_org");

      const enrollment = await Enrollment.findByClassAndUser(
        classroomA._id,
        userId
      );
      assert.equal(enrollment, null);

      const updatedPool = await SeatPool.findById(pool._id);
      assert.equal(updatedPool.usedSeats, 0);
    });

    await t.test("leaveClassroom holds student-paid seat", async () => {
      const userId = new mongoose.Types.ObjectId();
      const claim = await SeatClaim.create({
        classroomId: classroomA._id,
        userId,
        source: "stripe_student",
        status: "active",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      await Enrollment.create({
        classroomId: classroomA._id,
        userId,
        role: "member",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      const result = await leaveClassroom({
        classroomId: classroomA._id,
        userId,
        organizationId,
        updatedBy: clerkUserId,
      });

      assert.equal(result.seatRelease.action, "held");

      const updatedClaim = await SeatClaim.findById(claim._id);
      assert.equal(updatedClaim.status, "held");
    });

    await t.test("releaseSeatsOnOrgRemoval cleans enrollments and mixed claims", async () => {
      const userId = new mongoose.Types.ObjectId();

      await Enrollment.create({
        classroomId: classroomA._id,
        userId,
        role: "member",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      await Enrollment.create({
        classroomId: classroomB._id,
        userId,
        role: "member",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      await SeatClaim.create({
        classroomId: classroomA._id,
        userId,
        seatPoolId: pool._id,
        source: "org_prepaid",
        status: "active",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      await SeatClaim.create({
        classroomId: classroomB._id,
        userId,
        source: "stripe_student",
        status: "active",
        organization: organizationId,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      pool.usedSeats = 1;
      await pool.save();

      const summary = await releaseSeatsOnOrgRemoval({
        organizationId,
        userId,
        updatedBy: clerkUserId,
      });

      assert.equal(summary.enrollmentsRemoved, 2);
      assert.ok(summary.orgSeatsReleased >= 1);
      assert.ok(summary.studentSeatsHeld >= 1);

      const activeEnrollments = await Enrollment.find({
        userId,
        organization: organizationId,
        isRemoved: false,
      });
      assert.equal(activeEnrollments.length, 0);

      const heldClaim = await SeatClaim.findOne({
        userId,
        organization: organizationId,
        source: "stripe_student",
        status: "held",
      });
      assert.ok(heldClaim);
    });

    await t.test("grantOrgSeatAndEnroll consumes pool and enrolls student", async () => {
      const member = await Member.create({
        clerkUserId: `grant_${suffix}`,
        email: `grant-${suffix}@example.com`,
        firstName: "Grant",
        lastName: "Student",
        organizationMemberships: [],
        createdAt: new Date(),
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      pool.usedSeats = 0;
      pool.totalSeats = 5;
      await pool.save();

      const organization = await Organization.findById(organizationId);

      const result = await grantOrgSeatAndEnroll({
        classroom: classroomA,
        organization,
        member,
        source: "manual_comp",
        reason: "TA access",
        grantedBy: clerkUserId,
      });

      assert.equal(result.decision, "manual_comp");
      assert.ok(result.claim);
      assert.ok(result.enrollment);

      const enrollment = await Enrollment.findByClassAndUser(
        classroomA._id,
        member._id
      );
      assert.ok(enrollment);

      const updatedPool = await SeatPool.findById(pool._id);
      assert.equal(updatedPool.usedSeats, 1);

      const claim = await SeatClaim.findActiveClaim(classroomA._id, member._id);
      assert.ok(claim);
      assert.equal(claim.source, "manual_comp");
    });
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
});
