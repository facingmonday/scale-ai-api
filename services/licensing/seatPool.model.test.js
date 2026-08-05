const test = require("node:test");
const assert = require("node:assert/strict");
const SeatPool = require("./seatPool.model");

const { computeOrgSeatAvailability } = SeatPool;

test("computeOrgSeatAvailability: 50 total, 1 reserved, 0 used => 49 floating", () => {
  const result = computeOrgSeatAvailability({
    totalSeats: 50,
    usedSeats: 0,
    reservedUnclaimed: 1,
  });

  assert.equal(result.floatingAvailable, 49);
  assert.equal(result.remainingSeats, 49);
  assert.equal(result.canReserve, true);
});

test("computeOrgSeatAvailability: full pool has no floating or reserve capacity", () => {
  const result = computeOrgSeatAvailability({
    totalSeats: 10,
    usedSeats: 8,
    reservedUnclaimed: 2,
  });

  assert.equal(result.floatingAvailable, 0);
  assert.equal(result.canReserve, false);
});

test("computeOrgSeatAvailability: used seats reduce floating pool", () => {
  const result = computeOrgSeatAvailability({
    totalSeats: 50,
    usedSeats: 5,
    reservedUnclaimed: 0,
  });

  assert.equal(result.floatingAvailable, 45);
});
