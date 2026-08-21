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
    },
    organizationId,
    clerkUserId
  );

  assert.ok(challenge);
  assert.equal(challenge.publishMode, "MANUAL");
  assert.equal(challenge.publishAt, null);
  assert.equal(challenge.automationMode, "FULL");
  assert.equal(challenge.closeSubmissionsAt.toISOString(), deadline.toISOString());
  assert.equal(challenge.processAt.toISOString(), deadline.toISOString());

  const manualChallenge = await Challenge.createScenario(
    classroomId,
    {
      title: "Manual Challenge",
      submissionDeadlineAt: deadline,
      automationMode: "MANUAL",
    },
    organizationId,
    clerkUserId
  );

  assert.equal(manualChallenge.automationMode, "MANUAL");
  assert.equal(manualChallenge.automationStatus, "UNSCHEDULED");

  const scheduledInstructorChallenge = await Challenge.createScenario(
    classroomId,
    {
      title: "Scheduled instructor-controlled challenge",
      publishMode: "SCHEDULED",
      publishAt: new Date("2026-09-01T15:00:00.000Z"),
      submissionDeadlineAt: deadline,
      automationMode: "MANUAL",
      feedbackReleaseMode: "DELAYED",
      feedbackReleaseAt: new Date("2026-09-09T15:00:00.000Z"),
    },
    organizationId,
    clerkUserId
  );

  assert.equal(scheduledInstructorChallenge.publishMode, "SCHEDULED");
  assert.equal(scheduledInstructorChallenge.automationMode, "MANUAL");
  assert.equal(scheduledInstructorChallenge.automationStatus, "SCHEDULED");
  assert.equal(scheduledInstructorChallenge.feedbackReleaseMode, "MANUAL");
  assert.equal(
    scheduledInstructorChallenge.feedbackReleaseAt.toISOString(),
    "2026-09-09T15:00:00.000Z"
  );
});
