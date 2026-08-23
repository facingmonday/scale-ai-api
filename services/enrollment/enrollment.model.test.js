const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
} = require("../../test/helpers/db");
const { stubClerkMembership } = require("../../test/helpers/clerk");
const {
  createOrganization,
  createClassroom,
  createMember,
  createSeatPool,
} = require("../../test/helpers/factories");
const { assertRejectsWithCode } = require("../../test/helpers/assertErrors");

const Enrollment = require("./enrollment.model");
const Member = require("../members/member.model");
const SeatClaim = require("../licensing/seatClaim.model");
const SeatPool = require("../licensing/seatPool.model");
const RosterSeat = require("../licensing/rosterSeat.model");
const Profile = require("../profile/profile.model");

test("enrollment ensureJoin", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await t.test("idempotent re-join returns existing enrollment", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_idempotent" });
    const classroom = await createClassroom(org._id, { joinPolicy: "open" });
    const member = await createMember({ clerkUserId: "user_idempotent" });
    const restoreClerk = stubClerkMembership(Member);

    await createSeatPool(org._id, { totalSeats: 5 });

    const first = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      joinSource: "invite_link",
    });

    const second = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      joinSource: "invite_link",
    });

    assert.equal(String(first.enrollment._id), String(second.enrollment._id));
    restoreClerk();
  });

  await t.test("org prepaid join creates claim and enrollment", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_prepaid" });
    const classroom = await createClassroom(org._id, { joinPolicy: "open" });
    const member = await createMember({ clerkUserId: "user_prepaid" });
    const restoreClerk = stubClerkMembership(Member);

    await createSeatPool(org._id, { totalSeats: 5 });

    const result = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      joinSource: "invite_link",
    });

    assert.ok(result.enrollment);
    const claim = await SeatClaim.findActiveClaim(classroom._id, member._id);
    assert.ok(claim);
    assert.equal(claim.source, "org_prepaid");
    restoreClerk();
  });

  await t.test("copies a normalized email roster match student ID to enrollment only", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_roster_id" });
    const classroom = await createClassroom(org._id, { joinPolicy: "roster_only" });
    const member = await createMember({
      clerkUserId: "user_roster_id",
      email: "Student@Example.COM",
      organizationMemberships: [
        {
          id: "orgmem_roster_id",
          organizationId: org._id,
          role: "org:member",
          organization: { id: org.clerkOrganizationId, name: org.name },
          createdAt: new Date(),
        },
      ],
    });
    const restoreClerk = stubClerkMembership(Member);
    await createSeatPool(org._id, { totalSeats: 5 });
    const rosterSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "student@example.com",
      studentId: "S-100",
      organization: org._id,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });

    const { enrollment } = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      studentEmail: "  Student@Example.COM  ",
      joinSource: "invite_link",
    });

    assert.equal(enrollment.studentId, "S-100");
    const claim = await SeatClaim.findActiveClaim(classroom._id, member._id);
    assert.equal(String(claim.rosterSeatId), String(rosterSeat._id));
    assert.equal(await Profile.countDocuments({ userId: member._id }), 0);

    const roster = await Enrollment.getClassRoster(classroom._id);
    assert.equal(roster[0].studentId, "S-100");

    await Profile.create({
      classroomId: classroom._id,
      userId: member._id,
      studentId: "PROFILE-OLD",
      shopName: "Existing profile",
      storeDescription: "Existing profile description",
      storeLocation: "Existing profile location",
      profileType: new mongoose.Types.ObjectId(),
      organization: org._id,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });

    const rosterWithProfile = await Enrollment.getClassRoster(classroom._id);
    assert.equal(rosterWithProfile[0].studentId, "S-100");
    restoreClerk();
  });

  await t.test("copies roster student ID when an existing paid claim has no roster link", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_paid_roster_id" });
    const classroom = await createClassroom(org._id, { joinPolicy: "open" });
    const member = await createMember({
      clerkUserId: "user_paid_roster_id",
      organizationMemberships: [
        {
          id: "orgmem_paid_roster_id",
          organizationId: org._id,
          role: "org:member",
          organization: { id: org.clerkOrganizationId, name: org.name },
          createdAt: new Date(),
        },
      ],
    });
    const restoreClerk = stubClerkMembership(Member);
    const rosterSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "paid.student@example.com",
      studentId: "PAID-100",
      organization: org._id,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });
    const paidClaim = await SeatClaim.create({
      classroomId: classroom._id,
      userId: member._id,
      source: "stripe_student",
      organization: org._id,
      createdBy: "stripe_webhook",
      updatedBy: "stripe_webhook",
    });

    const { enrollment } = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      studentEmail: "  Paid.Student@Example.COM  ",
      joinSource: "invite_link",
    });

    assert.equal(enrollment.studentId, "PAID-100");

    const unchangedClaim = await SeatClaim.findById(paidClaim._id);
    assert.equal(unchangedClaim.rosterSeatId, undefined);

    const unchangedRosterSeat = await RosterSeat.findById(rosterSeat._id);
    assert.equal(unchangedRosterSeat.status, "reserved");

    const roster = await Enrollment.getClassRoster(classroom._id);
    assert.equal(roster[0].studentId, "PAID-100");
    restoreClerk();
  });

  await t.test("restores the roster student ID after removal and rejoin", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_restore_id" });
    const classroom = await createClassroom(org._id, { joinPolicy: "roster_only" });
    const member = await createMember({
      clerkUserId: "user_restore_id",
      email: "restore@example.com",
    });
    const restoreClerk = stubClerkMembership(Member);
    await createSeatPool(org._id, { totalSeats: 5 });
    const rosterSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "restore@example.com",
      studentId: "RESTORE-100",
      organization: org._id,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });

    const firstJoin = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      studentEmail: "restore@example.com",
      joinSource: "invite_link",
    });

    await Enrollment.leaveClassroom({
      classroomId: classroom._id,
      userId: member._id,
      organizationId: org._id,
      updatedBy: member.clerkUserId,
    });

    const releasedRosterSeat = await RosterSeat.findById(rosterSeat._id);
    assert.equal(releasedRosterSeat.status, "reserved");

    const secondJoin = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      studentEmail: "restore@example.com",
      joinSource: "invite_link",
    });

    assert.equal(
      String(secondJoin.enrollment._id),
      String(firstJoin.enrollment._id),
    );
    assert.equal(secondJoin.enrollment.isRemoved, false);
    assert.equal(secondJoin.enrollment.studentId, "RESTORE-100");
    restoreClerk();
  });

  await t.test("allows a rostered student whose roster entry has no student ID", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_roster_blank" });
    const classroom = await createClassroom(org._id, { joinPolicy: "roster_only" });
    const member = await createMember({
      clerkUserId: "user_roster_blank",
      email: "blank@example.com",
    });
    const restoreClerk = stubClerkMembership(Member);
    await createSeatPool(org._id, { totalSeats: 5 });
    const rosterEmail = "blank@example.com";
    await RosterSeat.create({
      classroomId: classroom._id,
      email: rosterEmail,
      studentId: "",
      organization: org._id,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });

    const { enrollment } = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      studentEmail: rosterEmail,
      joinSource: "invite_link",
    });

    assert.equal(enrollment.studentId, undefined);
    restoreClerk();
  });

  await t.test("allows unmatched students in open classrooms without a student ID", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_open_unmatched" });
    const classroom = await createClassroom(org._id, { joinPolicy: "open" });
    const member = await createMember({ clerkUserId: "user_open_unmatched" });
    const restoreClerk = stubClerkMembership(Member);
    await createSeatPool(org._id, { totalSeats: 5 });

    const { enrollment } = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      studentEmail: member.email,
      joinSource: "invite_link",
    });

    assert.equal(enrollment.studentId, undefined);
    restoreClerk();
  });

  await t.test("does not match roster entries outside the classroom and organization", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_scope" });
    const otherOrg = await createOrganization({ clerkOrganizationId: "org_join_scope_other" });
    const classroom = await createClassroom(org._id, { joinPolicy: "open" });
    const otherClassroom = await createClassroom(org._id, { joinPolicy: "open" });
    const member = await createMember({
      clerkUserId: "user_join_scope",
      email: "scope@example.com",
    });
    const restoreClerk = stubClerkMembership(Member);
    await createSeatPool(org._id, { totalSeats: 5 });
    const rosterEmail = "scope@example.com";
    await RosterSeat.create([
      {
        classroomId: otherClassroom._id,
        email: rosterEmail,
        studentId: "OTHER-CLASS",
        organization: org._id,
        createdBy: member.clerkUserId,
        updatedBy: member.clerkUserId,
      },
      {
        classroomId: classroom._id,
        email: rosterEmail,
        studentId: "OTHER-ORG",
        organization: otherOrg._id,
        createdBy: member.clerkUserId,
        updatedBy: member.clerkUserId,
      },
    ]);

    const { enrollment } = await Enrollment.ensureJoin({
      orgId: org.clerkOrganizationId,
      classroomId: classroom._id,
      clerkUserId: member.clerkUserId,
      member,
      studentEmail: rosterEmail,
      joinSource: "invite_link",
    });

    assert.equal(enrollment.studentId, undefined);
    const claim = await SeatClaim.findActiveClaim(classroom._id, member._id);
    assert.equal(claim.rosterSeatId, undefined);
    restoreClerk();
  });

  await t.test("Anyone with link still requires payment when no organization seat is available", async () => {
    await clearCollections();
    const org = await createOrganization({
      clerkOrganizationId: "org_join_paid_link",
    });
    const classroom = await createClassroom(org._id, {
      joinPolicy: "invite_link",
      allowAnonymousJoin: true,
    });
    const member = await createMember({ clerkUserId: "user_paid_link" });
    const restoreClerk = stubClerkMembership(Member);
    const pool = await createSeatPool(org._id, {
      totalSeats: 0,
      usedSeats: 0,
    });

    await assertRejectsWithCode(
      Enrollment.ensureJoin({
        orgId: org.clerkOrganizationId,
        classroomId: classroom._id,
        clerkUserId: member.clerkUserId,
        member,
        studentEmail: member.email,
        joinSource: "invite_link",
      }),
      "PAYMENT_REQUIRED",
      { statusCode: 402 },
    );

    const unchangedPool = await SeatPool.findById(pool._id);
    assert.equal(unchangedPool.usedSeats, 0);
    assert.equal(
      await Enrollment.countDocuments({
        classroomId: classroom._id,
        isRemoved: false,
      }),
      0,
    );
    assert.equal(
      await SeatClaim.countDocuments({
        classroomId: classroom._id,
        status: "active",
      }),
      0,
    );
    restoreClerk();
  });

  await t.test("Roster + link still requires a paid seat", async () => {
    await clearCollections();
    const org = await createOrganization({
      clerkOrganizationId: "org_join_roster_link_payment",
    });
    const classroom = await createClassroom(org._id, {
      joinPolicy: "invite_link",
      allowAnonymousJoin: false,
    });
    const rosterEmail = "roster-link-payment@example.com";
    const member = await createMember({
      clerkUserId: "user_roster_link_payment",
    });
    const restoreClerk = stubClerkMembership(Member);
    await createSeatPool(org._id, { totalSeats: 0, usedSeats: 0 });
    await RosterSeat.create({
      classroomId: classroom._id,
      email: rosterEmail,
      organization: org._id,
      createdBy: member.clerkUserId,
      updatedBy: member.clerkUserId,
    });

    await assertRejectsWithCode(
      Enrollment.ensureJoin({
        orgId: org.clerkOrganizationId,
        classroomId: classroom._id,
        clerkUserId: member.clerkUserId,
        member,
        studentEmail: rosterEmail,
        joinSource: "invite_link",
      }),
      "PAYMENT_REQUIRED",
      { statusCode: 402 },
    );
    restoreClerk();
  });

  await t.test("payment required when no seats available", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_payment" });
    const classroom = await createClassroom(org._id, {
      joinPolicy: "open",
      studentPaysAllowed: true,
    });
    const member = await createMember({ clerkUserId: "user_payment" });
    const restoreClerk = stubClerkMembership(Member);

    await createSeatPool(org._id, { totalSeats: 0, usedSeats: 0 });

    await assertRejectsWithCode(
      Enrollment.ensureJoin({
        orgId: org.clerkOrganizationId,
        classroomId: classroom._id,
        clerkUserId: member.clerkUserId,
        member,
        joinSource: "invite_link",
      }),
      "PAYMENT_REQUIRED",
      { statusCode: 402 }
    );
    restoreClerk();
  });

  await t.test("roster_only blocks join without roster seat", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_roster" });
    const classroom = await createClassroom(org._id, {
      joinPolicy: "roster_only",
      allowAnonymousJoin: true,
    });
    const member = await createMember({ clerkUserId: "user_roster" });
    const restoreClerk = stubClerkMembership(Member);

    await assertRejectsWithCode(
      Enrollment.ensureJoin({
        orgId: org.clerkOrganizationId,
        classroomId: classroom._id,
        clerkUserId: member.clerkUserId,
        member,
        joinSource: "invite_link",
      }),
      "ROSTER_ONLY"
    );
    restoreClerk();
  });

  await t.test("classroom not found returns 404", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_join_404" });
    const member = await createMember({ clerkUserId: "user_404" });
    const restoreClerk = stubClerkMembership(Member);
    await assert.rejects(
      Enrollment.ensureJoin({
        orgId: org.clerkOrganizationId,
        classroomId: new mongoose.Types.ObjectId(),
        clerkUserId: member.clerkUserId,
        member,
      }),
      (err) => err.statusCode === 404
    );
    restoreClerk();
  });
});
