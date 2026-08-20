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
  createSeatPool,
} = require("../../test/helpers/factories");

const RosterSeat = require("./rosterSeat.model");
const SeatClaim = require("./seatClaim.model");

test("rosterSeat model", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await t.test("findReservableForEmail finds reserved seat by email", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroom = await createClassroom(org._id);
    const clerkUserId = "roster_test_user";

    await RosterSeat.create({
      classroomId: classroom._id,
      email: "student@example.com",
      status: "reserved",
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const found = await RosterSeat.findReservableForEmail(
      classroom._id,
      "  Student@Example.COM  ",
      org._id,
    );
    assert.ok(found);
    assert.equal(found.email, "student@example.com");
    assert.equal(found.status, "reserved");
  });

  await t.test("attachForClaim claims roster seat for member email", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroom = await createClassroom(org._id);
    const member = await createMember({ email: "attach@example.com" });
    const clerkUserId = "roster_attach_user";

    const rosterSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "attach@example.com",
      status: "reserved",
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const claim = new SeatClaim({
      classroomId: classroom._id,
      userId: member._id,
      source: "org_prepaid",
      status: "active",
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const attached = await RosterSeat.attachForClaim({
      claim,
      member: { _id: member._id, email: "attach@example.com" },
      classroomId: classroom._id,
      updatedBy: clerkUserId,
    });

    assert.ok(attached);
    assert.equal(String(attached._id), String(rosterSeat._id));
    assert.equal(attached.status, "claimed");
    assert.equal(String(attached.claimedBy), String(member._id));
    assert.equal(String(claim.rosterSeatId), String(rosterSeat._id));
  });

  await t.test("releaseForClaim resets roster seat to reserved", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroom = await createClassroom(org._id);
    const member = await createMember({ email: "release@example.com" });
    const clerkUserId = "roster_release_user";

    const rosterSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "release@example.com",
      status: "claimed",
      claimedBy: member._id,
      claimedAt: new Date(),
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const claim = {
      rosterSeatId: rosterSeat._id,
    };

    await RosterSeat.releaseForClaim(claim, clerkUserId);

    const updated = await RosterSeat.findById(rosterSeat._id);
    assert.equal(updated.status, "reserved");
    assert.equal(updated.claimedBy, undefined);
    assert.equal(updated.claimedAt, undefined);
  });

  await t.test("re-import updates fields without resetting claimed status", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroom = await createClassroom(org._id);
    const member = await createMember({ email: "claimed@example.com" });
    const clerkUserId = "roster_reimport_user";

    const claimedSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "claimed@example.com",
      studentId: "OLD-ID",
      firstName: "Old",
      lastName: "Name",
      status: "claimed",
      claimedBy: member._id,
      claimedAt: new Date(),
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    const omittedSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "omitted@example.com",
      status: "reserved",
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await RosterSeat.importRows({
      classroom,
      rows: [
        {
          email: "claimed@example.com",
          studentId: "NEW-ID",
          firstName: "Updated",
          lastName: "Student",
          section: "B",
        },
        {
          email: "new@example.com",
          studentId: "NEW-STUDENT",
          firstName: "New",
          lastName: "Student",
          section: "B",
        },
      ],
      updatedBy: clerkUserId,
    });

    const updatedClaimedSeat = await RosterSeat.findById(claimedSeat._id);
    assert.equal(updatedClaimedSeat.studentId, "NEW-ID");
    assert.equal(updatedClaimedSeat.firstName, "Updated");
    assert.equal(updatedClaimedSeat.status, "claimed");
    assert.equal(String(updatedClaimedSeat.claimedBy), String(member._id));
    assert.ok(updatedClaimedSeat.claimedAt);

    const unchangedOmittedSeat = await RosterSeat.findById(omittedSeat._id);
    assert.ok(unchangedOmittedSeat);
    assert.equal(unchangedOmittedSeat.status, "reserved");

    const newSeat = await RosterSeat.findOne({ email: "new@example.com" });
    assert.ok(newSeat);
    assert.equal(newSeat.status, "reserved");
  });

  await t.test("clear removes roster entries and preserves active claims", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroom = await createClassroom(org._id);
    const otherOrg = await createOrganization();
    const otherClassroom = await createClassroom(otherOrg._id);
    const member = await createMember({ email: "active@example.com" });
    const clerkUserId = "roster_clear_user";

    const claimedSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "active@example.com",
      status: "claimed",
      claimedBy: member._id,
      claimedAt: new Date(),
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    await RosterSeat.create({
      classroomId: classroom._id,
      email: "reserved@example.com",
      status: "reserved",
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    const otherRosterSeat = await RosterSeat.create({
      classroomId: otherClassroom._id,
      email: "other-org@example.com",
      status: "reserved",
      organization: otherOrg._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    const claim = await SeatClaim.create({
      classroomId: classroom._id,
      userId: member._id,
      rosterSeatId: claimedSeat._id,
      source: "manual_comp",
      status: "active",
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const result = await RosterSeat.clearForClassroom({
      classroomId: classroom._id,
      organizationId: org._id,
      updatedBy: clerkUserId,
    });

    assert.deepEqual(result, { deleted: 2, detachedClaims: 1 });
    assert.equal(await RosterSeat.countDocuments({ classroomId: classroom._id }), 0);
    assert.ok(await RosterSeat.findById(otherRosterSeat._id));

    const preservedClaim = await SeatClaim.findById(claim._id);
    assert.equal(preservedClaim.status, "active");
    assert.equal(preservedClaim.rosterSeatId, undefined);
  });

  await t.test("removeSeat deletes one reserved seat", async () => {
    await clearCollections();
    const org = await createOrganization();
    const classroom = await createClassroom(org._id);
    const clerkUserId = "roster_remove_user";

    const targetSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "remove-me@example.com",
      status: "reserved",
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    const keepSeat = await RosterSeat.create({
      classroomId: classroom._id,
      email: "keep-me@example.com",
      status: "reserved",
      organization: org._id,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const result = await RosterSeat.removeSeat({
      classroomId: classroom._id,
      organizationId: org._id,
      seatId: targetSeat._id,
      updatedBy: clerkUserId,
    });

    assert.deepEqual(result, { deleted: 1, detachedClaims: 0 });
    assert.equal(await RosterSeat.findById(targetSeat._id), null);
    assert.ok(await RosterSeat.findById(keepSeat._id));
  });

  await t.test(
    "removeSeat detaches claim without unenrolling and scopes by classroom",
    async () => {
      await clearCollections();
      const org = await createOrganization();
      const classroom = await createClassroom(org._id);
      const otherClassroom = await createClassroom(org._id);
      const member = await createMember({ email: "claimed@example.com" });
      const clerkUserId = "roster_remove_claimed_user";

      const claimedSeat = await RosterSeat.create({
        classroomId: classroom._id,
        email: "claimed@example.com",
        status: "claimed",
        claimedBy: member._id,
        claimedAt: new Date(),
        organization: org._id,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });
      const otherClassroomSeat = await RosterSeat.create({
        classroomId: otherClassroom._id,
        email: "other-class@example.com",
        status: "reserved",
        organization: org._id,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });
      const claim = await SeatClaim.create({
        classroomId: classroom._id,
        userId: member._id,
        rosterSeatId: claimedSeat._id,
        source: "manual_comp",
        status: "active",
        organization: org._id,
        createdBy: clerkUserId,
        updatedBy: clerkUserId,
      });

      const missing = await RosterSeat.removeSeat({
        classroomId: classroom._id,
        organizationId: org._id,
        seatId: otherClassroomSeat._id,
        updatedBy: clerkUserId,
      });
      assert.equal(missing, null);
      assert.ok(await RosterSeat.findById(otherClassroomSeat._id));

      const result = await RosterSeat.removeSeat({
        classroomId: classroom._id,
        organizationId: org._id,
        seatId: claimedSeat._id,
        updatedBy: clerkUserId,
      });

      assert.deepEqual(result, { deleted: 1, detachedClaims: 1 });
      assert.equal(await RosterSeat.findById(claimedSeat._id), null);
      assert.ok(await RosterSeat.findById(otherClassroomSeat._id));

      const preservedClaim = await SeatClaim.findById(claim._id);
      assert.equal(preservedClaim.status, "active");
      assert.equal(preservedClaim.rosterSeatId, undefined);
    },
  );
});
