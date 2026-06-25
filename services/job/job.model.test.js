const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const Job = require("./job.model");

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
    "test"
  );

  assert.equal(job.status, "pending");

  await job.markRunning();
  assert.equal(job.status, "running");

  await job.markCompleted();
  assert.equal(job.status, "completed");
});
