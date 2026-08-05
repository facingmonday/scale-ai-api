const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
} = require("../../test/helpers/db");
const {
  createOrganization,
  createSeatPool,
} = require("../../test/helpers/factories");

const SeatPool = require("./seatPool.model");
const OrgSeatReservation = require("./orgSeatReservation.model");

test("seatPool integration", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await t.test("claimPrepaidSeatAtomically increments usedSeats", async () => {
    await clearCollections();
    const org = await createOrganization();
    const pool = await createSeatPool(org._id, { totalSeats: 5, usedSeats: 0 });
    const clerkUserId = "pool_claim_user";

    const claimed = await SeatPool.claimPrepaidSeatAtomically({
      organizationId: org._id,
      createdBy: clerkUserId,
    });

    assert.ok(claimed);
    assert.equal(claimed.usedSeats, 1);

    const updated = await SeatPool.findById(pool._id);
    assert.equal(updated.usedSeats, 1);
  });

  await t.test("releaseUsedSeatAtomically decrements usedSeats", async () => {
    await clearCollections();
    const org = await createOrganization();
    const pool = await createSeatPool(org._id, { totalSeats: 5, usedSeats: 2 });
    const clerkUserId = "pool_release_user";

    const released = await SeatPool.releaseUsedSeatAtomically({
      organizationId: org._id,
      updatedBy: clerkUserId,
    });

    assert.ok(released);
    assert.equal(released.usedSeats, 1);
  });

  await t.test("claim fails when pool is exhausted", async () => {
    await clearCollections();
    const org = await createOrganization();
    await createSeatPool(org._id, { totalSeats: 1, usedSeats: 1 });
    await OrgSeatReservation.create({
      email: "reserved@example.com",
      status: "reserved",
      organization: org._id,
      createdBy: "test",
      updatedBy: "test",
    });

    const claimed = await SeatPool.claimPrepaidSeatAtomically({
      organizationId: org._id,
      createdBy: "test",
    });

    assert.equal(claimed, null);
  });

  await t.test("getOrgSeatAvailability accounts for reserved seats", async () => {
    await clearCollections();
    const org = await createOrganization();
    await createSeatPool(org._id, { totalSeats: 10, usedSeats: 2 });
    await OrgSeatReservation.create({
      email: "avail@example.com",
      status: "reserved",
      organization: org._id,
      createdBy: "test",
      updatedBy: "test",
    });

    const availability = await SeatPool.getOrgSeatAvailability(org._id);
    assert.equal(availability.totalSeats, 10);
    assert.equal(availability.usedSeats, 2);
    assert.equal(availability.reservedUnclaimed, 1);
    assert.equal(availability.floatingAvailable, 7);
  });
});
