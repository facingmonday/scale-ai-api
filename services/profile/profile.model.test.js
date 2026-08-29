const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Profile = require("./profile.model");
const LedgerEntry = require("../ledger/ledger.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
} = require("../../test/helpers/db");

test("profile model schema exists", () => {
  assert.ok(Profile.schema);
});

test("seedInitialLedgerEntry deducts startup cost from Week 0 cash", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });
  await clearCollections();

  const classroomId = new mongoose.Types.ObjectId();
  const organizationId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  await MetricDefinition.create([
    {
      classroomId,
      organization: organizationId,
      key: "cashBefore",
      label: "Cash Before",
      dataType: "number",
      format: "currency",
      isActive: true,
      createdBy: "test-admin",
      updatedBy: "test-admin",
    },
    {
      classroomId,
      organization: organizationId,
      key: "cashAfter",
      label: "Cash After",
      dataType: "number",
      format: "currency",
      isActive: true,
      createdBy: "test-admin",
      updatedBy: "test-admin",
    },
  ]);

  await Profile.seedInitialLedgerEntry(
    profileId,
    classroomId,
    userId,
    organizationId,
    "test-admin",
    { startingBalance: 50000, initialStartupCost: 45000 }
  );

  const entry = await LedgerEntry.findOne({
    classroomId,
    userId,
    challengeId: null,
  });

  assert.equal(entry.metrics.get("cashBefore"), 5000);
  assert.equal(entry.metrics.get("cashAfter"), 5000);
});
