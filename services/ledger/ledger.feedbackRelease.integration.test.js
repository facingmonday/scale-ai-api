const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");
const Challenge = require("../challenge/challenge.model");
const LedgerEntry = require("./ledger.model");
const Notification = require("../notifications/notifications.model");

before(setupTestDb);
after(teardownTestDb);
beforeEach(clearCollections);

async function createResult(feedbackReleaseMode) {
  const organization = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const challenge = await Challenge.create({
    classroomId,
    title: `${feedbackReleaseMode} feedback`,
    simulationMode: "direct",
    simulationConcurrency: 5,
    feedbackReleaseMode,
    organization,
    createdBy: "teacher",
    updatedBy: "teacher",
  });
  await LedgerEntry.create({
    classroomId,
    challengeId: challenge._id,
    userId,
    summary: "Result",
    aiMetadata: { model: "test", runId: "test", generatedAt: new Date() },
    organization,
    createdBy: "teacher",
    updatedBy: "teacher",
  });
  return challenge;
}

test("Individual + Immediate queues the student's email as that result is saved", async () => {
  await createResult("IMMEDIATE");
  assert.equal(await Notification.countDocuments({ type: "email" }), 1);
});

for (const mode of ["DELAYED", "MANUAL"]) {
  test(`Individual + ${mode} keeps feedback hidden and queues email at release`, async () => {
    const challenge = await createResult(mode);
    assert.equal(await Notification.countDocuments({}), 0);
    await LedgerEntry.sendResultsNotifications(challenge._id);
    assert.equal(await Notification.countDocuments({ type: "email" }), 1);
  });
}
