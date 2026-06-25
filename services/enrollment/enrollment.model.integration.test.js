const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");
const {
  createOrganization,
  createClassroom,
  createMember,
  createEnrollment,
  createSeatPool,
  createSeatClaim,
} = require("../../test/helpers/factories");

const Enrollment = require("./enrollment.model");
const SeatClaim = require("../licensing/seatClaim.model");
const SeatPool = require("../licensing/seatPool.model");
const Member = require("../members/member.model");

test("enrollment billing integration", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await t.test("leaveClassroom returns org seat to pool", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroomA = await createClassroom(org._id);
    const clerkUserId = "billing_leave_user";
    const userId = new mongoose.Types.ObjectId();
    const pool = await createSeatPool(org._id, { totalSeats: 10 });

    await createSeatClaim({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      overrides: { seatPoolId: pool._id, source: "org_prepaid", createdBy: clerkUserId },
    });

    pool.usedSeats = 1;
    await pool.save();

    await createEnrollment({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      overrides: { createdBy: clerkUserId },
    });

    const result = await Enrollment.leaveClassroom({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      updatedBy: clerkUserId,
    });

    assert.equal(result.seatRelease.action, "released_to_org");

    const enrollment = await Enrollment.findByClassAndUser(classroomA._id, userId);
    assert.equal(enrollment, null);

    const updatedPool = await SeatPool.findById(pool._id);
    assert.equal(updatedPool.usedSeats, 0);
  });

  await t.test("leaveClassroom holds student-paid seat", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroomA = await createClassroom(org._id);
    const clerkUserId = "billing_stripe_user";
    const userId = new mongoose.Types.ObjectId();

    const claim = await createSeatClaim({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      overrides: { source: "stripe_student", createdBy: clerkUserId },
    });

    await createEnrollment({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      overrides: { createdBy: clerkUserId },
    });

    const result = await Enrollment.leaveClassroom({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      updatedBy: clerkUserId,
    });

    assert.equal(result.seatRelease.action, "held");

    const updatedClaim = await SeatClaim.findById(claim._id);
    assert.equal(updatedClaim.status, "held");
  });

  await t.test("releaseSeatsOnOrgRemoval cleans enrollments and mixed claims", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroomA = await createClassroom(org._id);
    const classroomB = await createClassroom(org._id);
    const clerkUserId = "billing_org_removal";
    const userId = new mongoose.Types.ObjectId();
    const pool = await createSeatPool(org._id, { totalSeats: 10 });

    await createEnrollment({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      overrides: { createdBy: clerkUserId },
    });
    await createEnrollment({
      classroomId: classroomB._id,
      userId,
      organizationId: org._id,
      overrides: { createdBy: clerkUserId },
    });

    await createSeatClaim({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      overrides: { seatPoolId: pool._id, source: "org_prepaid", createdBy: clerkUserId },
    });
    await createSeatClaim({
      classroomId: classroomB._id,
      userId,
      organizationId: org._id,
      overrides: { source: "stripe_student", createdBy: clerkUserId },
    });

    pool.usedSeats = 1;
    await pool.save();

    const summary = await Enrollment.releaseSeatsOnOrgRemoval({
      organizationId: org._id,
      userId,
      updatedBy: clerkUserId,
    });

    assert.equal(summary.enrollmentsRemoved, 2);
    assert.ok(summary.orgSeatsReleased >= 1);
    assert.ok(summary.studentSeatsHeld >= 1);

    const activeEnrollments = await Enrollment.find({
      userId,
      organization: org._id,
      isRemoved: false,
    });
    assert.equal(activeEnrollments.length, 0);

    const heldClaim = await SeatClaim.findOne({
      userId,
      organization: org._id,
      source: "stripe_student",
      status: "held",
    });
    assert.ok(heldClaim);
  });

  await t.test("grantOrgSeatAndEnroll consumes pool and enrolls student", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroomA = await createClassroom(org._id);
    const clerkUserId = "billing_grant_user";
    const pool = await createSeatPool(org._id, { totalSeats: 5, usedSeats: 0 });

    const member = await createMember({
      clerkUserId: `grant_${Date.now()}`,
      email: `grant-${Date.now()}@example.com`,
    });

    const result = await Enrollment.grantOrgSeatAndEnroll({
      classroom: classroomA,
      organization: org,
      member,
      source: "manual_comp",
      reason: "TA access",
      grantedBy: clerkUserId,
    });

    assert.equal(result.decision, "manual_comp");
    assert.ok(result.claim);
    assert.ok(result.enrollment);

    const enrollment = await Enrollment.findByClassAndUser(classroomA._id, member._id);
    assert.ok(enrollment);

    const updatedPool = await SeatPool.findById(pool._id);
    assert.equal(updatedPool.usedSeats, 1);

    const claim = await SeatClaim.findActiveClaim(classroomA._id, member._id);
    assert.ok(claim);
    assert.equal(claim.source, "manual_comp");
  });
});
