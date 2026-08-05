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

const SeatClaim = require("./seatClaim.model");
const SeatPool = require("./seatPool.model");
const OrgSeatReservation = require("./orgSeatReservation.model");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");

test("seat lifecycle integration", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await t.test("org prepaid remove returns seat to pool", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroomA = await createClassroom(org._id);
    const classroomB = await createClassroom(org._id);
    const userId = new mongoose.Types.ObjectId();
    const clerkUserId = "seat_lifecycle_test_user";
    const pool = await createSeatPool(org._id, { totalSeats: 10 });

    const claim = await createSeatClaim({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      overrides: {
        seatPoolId: pool._id,
        source: "org_prepaid",
        createdBy: clerkUserId,
      },
    });

    pool.usedSeats = 1;
    await pool.save();

    await createEnrollment({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      overrides: { createdBy: clerkUserId },
    });

    const result = await SeatClaim.releaseSeatOnRemoval({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      updatedBy: clerkUserId,
    });

    assert.equal(result.action, "released_to_org");

    const updatedClaim = await SeatClaim.findById(claim._id);
    assert.equal(updatedClaim.status, "revoked");

    const updatedPool = await SeatPool.findById(pool._id);
    assert.equal(updatedPool.usedSeats, 0);

    // stripe hold + repoint flow
    const stripeClaim = await createSeatClaim({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      overrides: { source: "stripe_student", createdBy: clerkUserId },
    });

    const holdResult = await SeatClaim.releaseSeatOnRemoval({
      classroomId: classroomA._id,
      userId,
      organizationId: org._id,
      updatedBy: clerkUserId,
    });
    assert.equal(holdResult.action, "held");

    const updatedStripeClaim = await SeatClaim.findById(stripeClaim._id);
    assert.equal(updatedStripeClaim.status, "held");

    const heldClaim = await SeatClaim.findOne({
      userId,
      organization: org._id,
      status: "held",
    });

    const repointed = await SeatClaim.repointStudentClaim({
      claim: heldClaim,
      classroom: classroomB,
      member: { _id: userId },
      rosterSeat: null,
      updatedBy: clerkUserId,
    });

    assert.equal(String(repointed.classroomId), String(classroomB._id));
    assert.equal(repointed.status, "active");
  });

  await t.test("org reserved remove keeps reservation claimed and reclaims on rejoin", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroomA = await createClassroom(org._id);
    const classroomB = await createClassroom(org._id);
    const orgUserId = new mongoose.Types.ObjectId();
    const clerkUserId = "seat_reserved_user";
    const suffix = Date.now();
    const pool = await createSeatPool(org._id, { totalSeats: 10 });

    const reservation = await OrgSeatReservation.create({
      email: `student-${suffix}@example.com`,
      status: "claimed",
      claimedBy: orgUserId,
      claimedAt: new Date(),
      claimedClassroomId: classroomA._id,
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await createSeatClaim({
      classroomId: classroomA._id,
      userId: orgUserId,
      organizationId: org._id,
      overrides: {
        seatPoolId: pool._id,
        orgSeatReservationId: reservation._id,
        source: "org_reserved",
        createdBy: clerkUserId,
      },
    });

    pool.usedSeats = 1;
    await pool.save();

    const releaseResult = await SeatClaim.releaseSeatOnRemoval({
      classroomId: classroomA._id,
      userId: orgUserId,
      organizationId: org._id,
      updatedBy: clerkUserId,
    });

    assert.equal(releaseResult.action, "released_to_org");

    const updatedReservation = await OrgSeatReservation.findById(reservation._id);
    assert.equal(updatedReservation.status, "claimed");
    assert.equal(updatedReservation.claimedBy.toString(), orgUserId.toString());
    assert.equal(updatedReservation.claimedClassroomId, undefined);

    const updatedPool = await SeatPool.findById(pool._id);
    assert.equal(updatedPool.usedSeats, 0);

    const reclaimed = await OrgSeatReservation.reclaimClaimedReservationForMember({
      organizationId: org._id,
      memberId: orgUserId,
      classroomId: classroomB._id,
      clerkUserId,
    });

    assert.ok(reclaimed);
    assert.equal(String(reclaimed.reservation._id), String(reservation._id));

    const finalPool = await SeatPool.findById(pool._id);
    assert.equal(finalPool.usedSeats, 1);
  });

  await t.test("countActiveClassroomClaims ignores claims without enrollment", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroomA = await createClassroom(org._id);
    const clerkUserId = "count_claims_user";

    await createSeatClaim({
      classroomId: classroomA._id,
      userId: new mongoose.Types.ObjectId(),
      organizationId: org._id,
      overrides: { source: "stripe_student", createdBy: clerkUserId },
    });

    const enrolledUserId = new mongoose.Types.ObjectId();
    await createSeatClaim({
      classroomId: classroomA._id,
      userId: enrolledUserId,
      organizationId: org._id,
      overrides: { source: "org_prepaid", createdBy: clerkUserId },
    });
    await createEnrollment({
      classroomId: classroomA._id,
      userId: enrolledUserId,
      organizationId: org._id,
      overrides: { createdBy: clerkUserId },
    });

    const count = await SeatClaim.countActiveClassroomClaims(classroomA._id);
    assert.equal(count, 1);
  });

  await t.test("transfer moves claim without changing usedSeats", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroomA = await createClassroom(org._id);
    const classroomB = await createClassroom(org._id);
    const clerkUserId = "transfer_user";
    const pool = await createSeatPool(org._id, { totalSeats: 10, usedSeats: 3 });
    const transferUserId = new mongoose.Types.ObjectId();

    await Member.create({
      _id: transferUserId,
      clerkUserId: `transfer_${Date.now()}`,
      email: `transfer-${Date.now()}@example.com`,
      firstName: "Transfer",
      lastName: "Student",
      organizationMemberships: [],
      createdAt: new Date(),
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await createEnrollment({
      classroomId: classroomA._id,
      userId: transferUserId,
      organizationId: org._id,
      overrides: { createdBy: clerkUserId },
    });

    await createSeatClaim({
      classroomId: classroomA._id,
      userId: transferUserId,
      organizationId: org._id,
      overrides: {
        seatPoolId: pool._id,
        source: "org_prepaid",
        createdBy: clerkUserId,
      },
    });

    const result = await Enrollment.transferStudentBetweenClassrooms({
      organizationId: org._id,
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
});
