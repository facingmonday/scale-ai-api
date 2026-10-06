const test = require("node:test");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { setupTestDb, teardownTestDb, mongoose } = require("../../test/helpers/db");
const Classroom = require("./classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const LedgerEntry = require("../ledger/ledger.model");
const Member = require("../members/member.model");
const Profile = require("../profile/profile.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");
require("../job/job.model");

test("dashboard query count stays bounded for a large classroom", async (t) => {
  await setupTestDb();
  t.after(teardownTestDb);
  const organization = new mongoose.Types.ObjectId();
  const classroom = await Classroom.create({
    name: "Large classroom", organization,
    ownership: new mongoose.Types.ObjectId(), createdBy: "test", updatedBy: "test",
  });
  const classroomId = classroom._id;
  const scope = { classroomId, organization, createdBy: "test", updatedBy: "test" };
  const users = Array.from({ length: 287 }, () => new mongoose.Types.ObjectId());
  const challenges = Array.from({ length: 12 }, (_, week) => ({
    ...scope, _id: new mongoose.Types.ObjectId(), title: `Week ${week + 1}`,
    week: week + 1, isPublished: true, isClosed: week < 11,
  }));
  // Insert fixtures directly to avoid unrelated simulation/notification save hooks.
  await Member.collection.insertMany(users.map((_id, index) => ({
    _id, clerkUserId: `large-${index}`,
    organizationMemberships: [{ organizationId: organization, role: "org:member" }],
  })));
  await Enrollment.collection.insertMany(users.map((userId) => ({
    ...scope, userId, role: "member", isRemoved: false,
  })));
  await Challenge.collection.insertMany(challenges);
  await Profile.collection.insertMany(users.map((userId, index) => ({
    ...scope, userId, shopName: `Shop ${String(index).padStart(3, "0")}`,
    studentId: `S${index}`,
  })));
  await MetricDefinition.create([
    ["revenue", "sum"], ["profit", "avg"], ["cash", "last"],
  ].map(([key, aggregation], sortOrder) => ({
    ...scope, key, label: key, aggregation, sortOrder, dataType: "number",
    displayIn: { leaderboard: true }, isPrimaryLeaderboardMetric: sortOrder === 0,
  })));
  await LedgerEntry.collection.insertMany(users.flatMap((userId, index) =>
    challenges.slice(0, 11).map((challenge, week) => ({
      ...scope, userId, challengeId: challenge._id,
      metrics: {
        // Ties cross both the five-row and ten-row primary leaderboard cutoffs.
        revenue: index === 281 ? 283 : index === 276 ? 278 : index + 1,
        profit: index + week,
        cash: index + week,
      },
      createdDate: new Date(Date.UTC(2026, 8, week + 1)),
    }))
  ));
  await Decision.collection.insertMany(users.slice(0, 52).map((userId) => ({
    ...scope, userId, challengeId: challenges[11]._id,
  })));

  async function measure() {
    const queries = [];
    const previousDebug = mongoose.get("debug");
    mongoose.set("debug", (collection, operation) => {
      if (["find", "findOne", "countDocuments", "aggregate"].includes(operation)) {
        queries.push(`${collection}.${operation}`);
      }
    });
    try {
      const start = performance.now();
      const dashboard = await Classroom.getDashboard(classroomId, organization);
      const elapsed = performance.now() - start;
      t.diagnostic(`${dashboard.submissionsCompleted} submissions: ${queries.length} database operations, ${elapsed.toFixed(0)} ms`);
      return { dashboard, queries };
    } finally {
      mongoose.set("debug", previousDebug);
    }
  }

  const first = await measure();
  assert.equal(first.dashboard.students, 287);
  assert.equal(first.dashboard.submissionsCompleted, 52);
  assert.equal(first.dashboard.leaderboardTop10.length, 10);
  assert.equal(first.dashboard.leaderboardTop10[0].metricTotal, 287 * 11);
  assert.deepEqual(first.dashboard.leaderboards.map(({ entries }) => entries[0].metricTotal),
    [287 * 11, 291, 296]);
  assert.deepEqual(first.dashboard.leaderboards[0].entries, first.dashboard.leaderboardTop10.slice(0, 5));
  assert.equal(first.dashboard.leaderboards[0].entries[4].rank, 5);
  assert.equal(first.dashboard.leaderboards[0].entries[4].isTied, true);
  assert.equal(first.dashboard.leaderboardTop10[9].rank, 10);
  assert.equal(first.dashboard.leaderboardTop10[9].isTied, true);

  await Decision.collection.insertMany(users.slice(52).map((userId) => ({
    ...scope, userId, challengeId: challenges[11]._id,
  })));
  const full = await measure();
  assert.equal(full.dashboard.submissionsCompleted, 287);
  assert.deepEqual(full.dashboard.leaderboards, first.dashboard.leaderboards);
  assert.ok(full.queries.length < 30, `Unexpected query fan-out: ${full.queries.length}`);
  assert.equal(full.queries.length, first.queries.length);
  assert.equal(full.queries.filter((query) => query === "ledgerentries.aggregate").length, 3);
  assert.ok(!full.queries.includes("decisions.find"));
});
