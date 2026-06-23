const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const Challenge = require("./challenge.model");

test("createScenario defaults closeSubmissionsAt and processAt to submissionDeadlineAt", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await clearCollections();
  const classroomId = new mongoose.Types.ObjectId();
  const organizationId = new mongoose.Types.ObjectId();
  const clerkUserId = "test-user-123";
  const deadline = new Date("2026-09-08T15:00:00.000Z");

  const challenge = await Challenge.createScenario(
    classroomId,
    {
      title: "Test Default Dates Challenge",
      description: "Testing default dates",
      submissionDeadlineAt: deadline,
      automationMode: "FULL",
    },
    organizationId,
    clerkUserId
  );

  assert.ok(challenge);
  assert.equal(challenge.closeSubmissionsAt.toISOString(), deadline.toISOString());
  assert.equal(challenge.processAt.toISOString(), deadline.toISOString());
});
