const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const Job = require("./job.model");
const EvaluationReplacement = require("./evaluationReplacement.model");

test("job model lifecycle", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await clearCollections();
  const classroomId = new mongoose.Types.ObjectId();
  const challengeId = new mongoose.Types.ObjectId();
  const orgId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const job = await Job.createJob(
    { classroomId, challengeId, userId },
    orgId,
    "test",
  );

  assert.equal(job.status, "pending");

  await job.markRunning();
  assert.equal(job.status, "running");
  assert.equal(job.attempts, 1);

  await job.markCompleted();
  assert.equal(job.status, "completed");
  assert.deepEqual(
    job.history.map((event) => event.action),
    ["processing_started", "processing_completed"],
  );
});

test("only one actionable replacement exists per student and retained history is allowed", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });
  await clearCollections();
  await EvaluationReplacement.init();
  const ids = {
    classroomId: new mongoose.Types.ObjectId(),
    challengeId: new mongoose.Types.ObjectId(),
    decisionId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    publishedLedgerEntryId: new mongoose.Types.ObjectId(),
    organization: new mongoose.Types.ObjectId(),
  };
  const activeKey = `${ids.challengeId}:${ids.userId}`;
  const input = {
    ...ids,
    activeKey,
    originalResult: { summary: "Published" },
    createdBy: "teacher",
    updatedBy: "teacher",
  };

  const first = await EvaluationReplacement.create(input);
  await assert.rejects(
    EvaluationReplacement.create(input),
    (error) => error?.code === 11000,
  );

  first.state = "discarded";
  first.activeKey = undefined;
  await first.save();
  const second = await EvaluationReplacement.create(input);
  assert.notEqual(String(second._id), String(first._id));
});
