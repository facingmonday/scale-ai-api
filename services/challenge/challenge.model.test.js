const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const Challenge = require("./challenge.model");
const Outcome = require("../outcome/outcome.model");

test("scheduled challenges default to full automation metadata when configured", async () => {
  const challenge = new Challenge({
    classroomId: "507f1f77bcf86cd799439011",
    title: "Week 3",
    publishAt: new Date("2026-09-01T15:00:00.000Z"),
    submissionDeadlineAt: new Date("2026-09-08T15:00:00.000Z"),
    automationMode: "FULL",
    automationStatus: "SCHEDULED",
    missingSubmissionPolicy: "FORWARD_PREVIOUS",
    punishAbsentStudents: "low",
    organization: "507f1f77bcf86cd799439012",
    createdBy: "test",
    updatedBy: "test",
  });

  await challenge.validate();

  assert.equal(challenge.automationMode, "FULL");
  assert.equal(challenge.automationStatus, "SCHEDULED");
  assert.equal(challenge.missingSubmissionPolicy, "FORWARD_PREVIOUS");
  assert.equal(challenge.punishAbsentStudents, "low");
});

test("new challenge automation fields are validated successfully", async () => {
  const challenge = new Challenge({
    classroomId: "507f1f77bcf86cd799439011",
    title: "Week 4",
    publishAt: new Date(),
    submissionDeadlineAt: new Date(),
    closeSubmissionsAt: new Date(),
    processAt: new Date(),
    feedbackReleaseAt: new Date(),
    feedbackReleaseMode: "DELAYED",
    isFeedbackReleased: false,
    isLockedForStudents: true,
    allowLateSubmissions: true,
    lateSubmissionPolicy: { penaltyPercentPerDay: 5 },
    organization: "507f1f77bcf86cd799439012",
    createdBy: "test",
    updatedBy: "test",
  });

  await challenge.validate();

  assert.equal(challenge.feedbackReleaseMode, "DELAYED");
  assert.equal(challenge.automationMode, "FULL");
  assert.equal(challenge.isLockedForStudents, true);
  assert.equal(challenge.allowLateSubmissions, true);
  assert.equal(challenge.lateSubmissionPolicy.penaltyPercentPerDay, 5);
});

test("all lifecycle automation statuses validate successfully", async () => {
  const lifecycleStatuses = [
    "SCHEDULED",
    "acceptingSubmissions",
    "submissionsClosed",
    "queuedForProcessing",
    "processing",
    "processed",
    "feedbackReleased",
    "BLOCKED",
    "FAILED",
  ];

  for (const automationStatus of lifecycleStatuses) {
    const challenge = new Challenge({
      classroomId: "507f1f77bcf86cd799439011",
      title: `Lifecycle status: ${automationStatus}`,
      automationMode: "FULL",
      automationStatus,
      organization: "507f1f77bcf86cd799439012",
      createdBy: "test",
      updatedBy: "test",
    });

    await challenge.validate();
    assert.equal(challenge.automationStatus, automationStatus);
  }
});

test("challenge exports lifecycle statics", () => {
  assert.equal(typeof Challenge.createScenario, "function");
  assert.equal(typeof Challenge.publishDueScenarios, "function");
  assert.equal(typeof Challenge.closeDueSubmissions, "function");
  assert.equal(typeof Challenge.processDueOutcomes, "function");
});

const leaderboardMetricDefinitions = [
  {
    key: "revenue",
    dataType: "number",
    isActive: true,
    displayIn: { leaderboard: true },
  },
];

function createLeaderboardSubmission(id, revenue) {
  return {
    _id: id,
    userId: { _id: `user-${id}` },
    profile: {
      _id: `profile-${id}`,
      studentId: `student-${id}`,
      shopName: `Shop ${id}`,
      profileType: { label: "restaurant" },
    },
    ledgerEntryId: { metrics: { revenue } },
  };
}

test("a sole top performer is not also a lowest performer", async () => {
  const stats = await Challenge.getStoreTypeStats(
    [createLeaderboardSubmission("decision-1", 100)],
    leaderboardMetricDefinitions
  );

  assert.deepEqual(
    stats.restaurant.winners.map((entry) => entry.decisionId),
    ["decision-1"]
  );
  assert.deepEqual(stats.restaurant.losers, []);
});

test("lowest performers exclude every top performer in a small class", async () => {
  const submissions = [500, 400, 300, 200, 100].map((revenue, index) =>
    createLeaderboardSubmission(`decision-${index + 1}`, revenue)
  );

  const stats = await Challenge.getStoreTypeStats(
    submissions,
    leaderboardMetricDefinitions
  );
  const winners = stats.restaurant.winners.map((entry) => entry.decisionId);
  const losers = stats.restaurant.losers.map((entry) => entry.decisionId);

  assert.deepEqual(winners, ["decision-1", "decision-2", "decision-3"]);
  assert.deepEqual(losers, ["decision-5", "decision-4"]);
  assert.deepEqual(
    winners.filter((decisionId) => losers.includes(decisionId)),
    []
  );
});
