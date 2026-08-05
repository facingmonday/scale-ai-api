const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
} = require("../../test/helpers/db");
const { assertRejectsWithCode } = require("../../test/helpers/assertErrors");
const { createOrganization, createSeatPool } = require("../../test/helpers/factories");

const OrgSeatReservation = require("./orgSeatReservation.model");

test("orgSeatReservation integration", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await t.test("createReservation reserves email against pool", async () => {
    await clearCollections();
    const org = await createOrganization();
    await createSeatPool(org._id, { totalSeats: 5, usedSeats: 0 });

    const reservation = await OrgSeatReservation.createReservation({
      organization: org,
      email: "Reserve@Example.com",
      createdBy: "admin_test",
    });

    assert.equal(reservation.email, "reserve@example.com");
    assert.equal(reservation.status, "reserved");
  });

  await t.test("createReservation rejects invalid email", async () => {
    await clearCollections();
    const org = await createOrganization();
    await createSeatPool(org._id, { totalSeats: 5 });

    await assertRejectsWithCode(
      OrgSeatReservation.createReservation({
        organization: org,
        email: "not-an-email",
        createdBy: "admin_test",
      }),
      "INVALID_EMAIL",
      { statusCode: 400 }
    );
  });

  await t.test("revokeReservation revokes unclaimed reservation", async () => {
    await clearCollections();
    const org = await createOrganization();
    await createSeatPool(org._id, { totalSeats: 5 });

    const reservation = await OrgSeatReservation.createReservation({
      organization: org,
      email: "revoke@example.com",
      createdBy: "admin_test",
    });

    const revoked = await OrgSeatReservation.revokeReservation({
      organization: org,
      reservationId: reservation._id,
      updatedBy: "admin_test",
    });

    assert.equal(revoked.status, "revoked");
  });
});
