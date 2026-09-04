const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const SimulationBatch = require("./simulationBatch.model");
const openai = require("../../lib/openai");

test("simulationBatch state machine", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await clearCollections();
  const classroomId = new mongoose.Types.ObjectId();
  const challengeId = new mongoose.Types.ObjectId();
  const orgId = new mongoose.Types.ObjectId();

  const batch = await SimulationBatch.createBatch(
    { classroomId, challengeId, jobCount: 3 },
    orgId,
    "test"
  );

  assert.equal(batch.status, "created");

  await batch.markSubmitted({ openaiBatchId: "batch_123" });
  assert.equal(batch.status, "submitted");

  await batch.updateFromOpenAIStatus({ status: "completed" });
  assert.equal(batch.status, "completed");
});

test("cancelling a challenge terminates created and provider-backed batches", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await clearCollections();
  const classroomId = new mongoose.Types.ObjectId();
  const challengeId = new mongoose.Types.ObjectId();
  const orgId = new mongoose.Types.ObjectId();
  const created = await SimulationBatch.createBatch(
    { classroomId, challengeId, jobCount: 1 },
    orgId,
    "test",
  );
  const submitted = await SimulationBatch.createBatch(
    { classroomId, challengeId, jobCount: 1 },
    orgId,
    "test",
  );
  await submitted.markSubmitted({ openaiBatchId: "batch_123" });

  const cancelledProviderIds = [];
  t.mock.method(openai.batches, "cancel", async (id) => {
    cancelledProviderIds.push(id);
  });

  const result = await SimulationBatch.cancelInProgressBatchForScenario(
    challengeId,
    orgId,
  );

  assert.equal(result.cancelled, true);
  assert.equal(result.count, 2);
  assert.deepEqual(cancelledProviderIds, ["batch_123"]);
  assert.equal(
    (await SimulationBatch.findById(created._id)).status,
    "cancelled",
  );
  assert.equal(
    (await SimulationBatch.findById(submitted._id)).status,
    "cancelled",
  );
});
