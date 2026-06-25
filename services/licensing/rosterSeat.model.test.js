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
      "  Student@Example.COM  "
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
});
