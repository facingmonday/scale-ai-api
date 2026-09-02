const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  mongoose,
} = require("../../test/helpers/db");

const Challenge = require("../challenge/challenge.model");
const LedgerEntry = require("./ledger.model");
const Notification = require("../notifications/notifications.model");

test("bulk result release creates no notifications for simulation challenges", async (t) => {
  await setupTestDb();
  t.after(teardownTestDb);

  const classroomId = new mongoose.Types.ObjectId();
  const organizationId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const actor = "sim_test_actor";

  const challenge = await Challenge.create({
    classroomId,
    title: "Suppressed simulation challenge",
    suppressNotifications: true,
    organization: organizationId,
    createdBy: actor,
    updatedBy: actor,
  });
  await LedgerEntry.create({
    classroomId,
    challengeId: challenge._id,
    userId,
    summary: "Simulation result",
    aiMetadata: {
      model: "test-model",
      runId: "test-run",
      generatedAt: new Date(),
    },
    organization: organizationId,
    createdBy: actor,
    updatedBy: actor,
  });

  await LedgerEntry.sendResultsNotifications(challenge._id);

  assert.equal(await Notification.countDocuments({}), 0);
});
