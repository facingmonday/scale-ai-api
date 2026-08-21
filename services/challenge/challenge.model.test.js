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

  assert.equal(challenge.publishMode, "SCHEDULED");
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

  assert.equal(challenge.publishMode, "SCHEDULED");
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
  assert.equal(typeof Challenge.getLifecycleStatus, "function");
});

test("getLifecycleStatus returns Scheduled without changing terminal precedence", () => {
  const now = new Date("2026-09-01T14:00:00.000Z");
  assert.equal(
    Challenge.getLifecycleStatus({
      isPublished: false,
      isLockedForStudents: false,
      isClosed: false,
    }),
    "Draft"
  );
  assert.equal(
    Challenge.getLifecycleStatus(
      {
        isPublished: false,
        isLockedForStudents: false,
        isClosed: false,
        publishAt: new Date("2026-09-01T15:00:00.000Z"),
        automationMode: "FULL",
        automationStatus: "SCHEDULED",
      },
      now
    ),
    "Scheduled"
  );
  assert.equal(
    Challenge.getLifecycleStatus(
      {
        isPublished: true,
        isLockedForStudents: false,
        isClosed: false,
        publishAt: new Date("2026-09-01T15:00:00.000Z"),
        automationMode: "FULL",
        automationStatus: "acceptingSubmissions",
      },
      now
    ),
    "Scheduled"
  );
  assert.equal(
    Challenge.getLifecycleStatus(
      {
        isPublished: false,
        isLockedForStudents: false,
        isClosed: false,
        publishAt: new Date("2026-09-01T13:00:00.000Z"),
        automationMode: "FULL",
        automationStatus: "SCHEDULED",
      },
      now
    ),
    "Scheduled"
  );
  assert.equal(
    Challenge.getLifecycleStatus({
      isPublished: true,
      isLockedForStudents: false,
      isClosed: false,
    }),
    "Open"
  );
  assert.equal(
    Challenge.getLifecycleStatus({
      isPublished: true,
      isLockedForStudents: true,
      isClosed: false,
    }),
    "Locked"
  );
  assert.equal(
    Challenge.getLifecycleStatus({
      isPublished: true,
      isLockedForStudents: false,
      isClosed: true,
    }),
    "Closed"
  );
  assert.equal(
    Challenge.getLifecycleStatus({
      isPublished: true,
      isLockedForStudents: true,
      isClosed: true,
      publishAt: new Date("2026-09-01T15:00:00.000Z"),
      automationMode: "FULL",
    }, now),
    "Closed"
  );
});

test("student visibility requires both publication and the configured start", () => {
  const beforeStart = new Date("2026-09-01T14:00:00.000Z");
  const atStart = new Date("2026-09-01T15:00:00.000Z");
  const challenge = {
    isPublished: true,
    publishAt: new Date("2026-09-01T15:00:00.000Z"),
  };

  assert.equal(Challenge.hasStarted(challenge, beforeStart), false);
  assert.equal(Challenge.isVisibleToStudents(challenge, beforeStart), false);
  assert.equal(Challenge.hasStarted(challenge, atStart), true);
  assert.equal(Challenge.isVisibleToStudents(challenge, atStart), true);
  assert.equal(
    Challenge.isVisibleToStudents({ ...challenge, isPublished: false }, atStart),
    false
  );
});

test("publish preserves a future full-automation challenge as scheduled", async () => {
  const challenge = new Challenge({
    classroomId: "507f1f77bcf86cd799439011",
    title: "Future challenge",
    publishAt: new Date(Date.now() + 60_000),
    automationMode: "FULL",
    automationStatus: "SCHEDULED",
    organization: "507f1f77bcf86cd799439012",
    createdBy: "test",
    updatedBy: "test",
  });
  challenge.save = async () => challenge;

  await challenge.publish("teacher");

  assert.equal(challenge.isPublished, false);
  assert.equal(challenge.automationStatus, "SCHEDULED");
  assert.equal(challenge.updatedBy, "teacher");
});

test("scheduled opening is independent of manual result automation", async () => {
  const challenge = new Challenge({
    classroomId: "507f1f77bcf86cd799439011",
    title: "Manual future challenge",
    publishAt: new Date(Date.now() + 60_000),
    publishMode: "SCHEDULED",
    automationMode: "MANUAL",
    organization: "507f1f77bcf86cd799439012",
    createdBy: "test",
    updatedBy: "test",
  });
  challenge.save = async () => challenge;

  await challenge.publish("teacher");

  assert.equal(challenge.isPublished, false);
  assert.equal(challenge.publishMode, "SCHEDULED");
  assert.equal(challenge.automationStatus, "SCHEDULED");
});

test("publishDueScenarios opens a scheduled challenge once it is due", async () => {
  const dueChallenge = {
    _id: { toString: () => "challenge-id" },
    classroomId: "classroom-id",
    title: "Due challenge",
    async publish(clerkUserId) {
      this.publishedBy = clerkUserId;
      this.isPublished = true;
      this.automationStatus = "acceptingSubmissions";
    },
  };
  const model = {
    find(query) {
      assert.equal(query.isPublished, false);
      assert.equal(query.$or[0].publishMode, "SCHEDULED");
      return { sort: async () => [dueChallenge] };
    },
    getActiveScenario: async () => null,
  };

  const results = await Challenge.publishDueScenarios.call(model, new Date());

  assert.equal(results.length, 1);
  assert.equal(results[0].status, "published");
  assert.equal(dueChallenge.isPublished, true);
  assert.equal(dueChallenge.automationStatus, "acceptingSubmissions");
  assert.equal(dueChallenge.publishedBy, "system");
});

test("post-opening workers remain limited to full automation", async () => {
  const model = {
    find(query) {
      assert.equal(query.automationMode, "FULL");
      assert.equal(query.isPublished, true);
      return { sort: async () => [] };
    },
  };

  const results = await Challenge.closeDueSubmissions.call(model, new Date());
  assert.deepEqual(results, []);
});

test("legacy publish mode resolves from publishAt", () => {
  assert.equal(
    Challenge.getPublishMode({ publishAt: new Date() }),
    "SCHEDULED"
  );
  assert.equal(Challenge.getPublishMode({ publishAt: null }), "MANUAL");
  assert.equal(
    Challenge.getPublishMode({ publishMode: "MANUAL", publishAt: new Date() }),
    "MANUAL"
  );
});

test("unpublish resets opening to a manual draft", async () => {
  const challenge = new Challenge({
    classroomId: "507f1f77bcf86cd799439011",
    title: "Open scheduled challenge",
    isPublished: true,
    isLockedForStudents: true,
    publishMode: "SCHEDULED",
    publishAt: new Date(),
    automationMode: "FULL",
    organization: "507f1f77bcf86cd799439012",
    createdBy: "test",
    updatedBy: "test",
  });
  challenge.save = async () => challenge;

  await challenge.unpublish("teacher");

  assert.equal(challenge.isPublished, false);
  assert.equal(challenge.isLockedForStudents, false);
  assert.equal(challenge.publishMode, "MANUAL");
  assert.equal(challenge.publishAt, null);
  assert.equal(challenge.automationStatus, "UNSCHEDULED");
});

test("lifecycleStatus virtual is included in toJSON", () => {
  const challenge = new Challenge({
    classroomId: "507f1f77bcf86cd799439011",
    title: "Week 5",
    isPublished: true,
    isLockedForStudents: true,
    isClosed: false,
    organization: "507f1f77bcf86cd799439012",
    createdBy: "test",
    updatedBy: "test",
  });

  assert.equal(challenge.lifecycleStatus, "Locked");
  assert.equal(challenge.toJSON().lifecycleStatus, "Locked");
  assert.equal(challenge.toJSON().publishMode, "MANUAL");
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
