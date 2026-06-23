const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const SimulationBatch = require("./simulationBatch.model");

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
