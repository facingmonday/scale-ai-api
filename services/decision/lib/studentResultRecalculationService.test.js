const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../../test/helpers/db");

const Challenge = require("../../challenge/challenge.model");
const Decision = require("../decision.model");
const Outcome = require("../../outcome/outcome.model");
const LedgerEntry = require("../../ledger/ledger.model");
const SimulationJob = require("../../job/job.model");
const SimulationBatch = require("../../job/simulationBatch.model");
const simulationQueue = require("../../../lib/queues/simulation-worker");
const service = require("./studentResultRecalculationService");

async function createFixture() {
  const organizationId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const base = {
    organization: organizationId,
    createdBy: "teacher",
    updatedBy: "teacher",
  };
  const challenge = await Challenge.create({
    ...base,
    classroomId,
    title: "Challenge one",
    week: 1,
    isPublished: true,
    isClosed: true,
    automationStatus: "processed",
  });
  const decision = await Decision.create({
    ...base,
    classroomId,
    challengeId: challenge._id,
    userId,
    processingStatus: "completed",
  });
  await Outcome.create({
    ...base,
    classroomId,
    challengeId: challenge._id,
    notes: "Shared outcome",
    approved: true,
  });
  const ledger = await LedgerEntry.create({
    ...base,
    classroomId,
    challengeId: challenge._id,
    decisionId: decision._id,
    userId,
    metrics: { netProfit: 100, cashAfter: 1000 },
    summary: "Original result",
    aiMetadata: {
      model: "test",
      runId: "original-run",
      generatedAt: new Date(),
    },
  });
  decision.ledgerEntryId = ledger._id;
  await decision.save();
  const job = await SimulationJob.create({
    ...base,
    classroomId,
    challengeId: challenge._id,
    decisionId: decision._id,
    userId,
    status: "completed",
    ledgerEntryId: ledger._id,
  });
  decision.jobs = [job._id];
  await decision.save();
  return {
    organizationId,
    classroomId,
    userId,
    challenge,
    decision,
    ledger,
    job,
  };
}

test.before(async () => {
  await setupTestDb();
});

test.after(async () => {
  // Challenge hooks intentionally dispatch some work after persistence.
  await new Promise((resolve) => setTimeout(resolve, 50));
  await teardownTestDb();
});

test.beforeEach(async () => {
  await clearCollections();
});

test("queues one direct upsert job and preserves the completed decision result", async (t) => {
  const fixture = await createFixture();
  const originalEnqueue = simulationQueue.enqueueSimulationJob;
  let queued = null;
  simulationQueue.enqueueSimulationJob = async (jobId, options) => {
    queued = { jobId: String(jobId), options };
  };
  t.after(() => {
    simulationQueue.enqueueSimulationJob = originalEnqueue;
  });

  const result = await service.recalculateStudentResult({
    decision: fixture.decision,
    organizationId: fixture.organizationId,
    clerkUserId: "requesting-teacher",
  });

  assert.equal(result.status, "pending");
  assert.equal(String(result.ledgerEntryId), String(fixture.ledger._id));
  assert.equal(queued.jobId, String(fixture.job._id));
  assert.equal(queued.options.recalculationRunId, result.recalculationRunId);

  const updatedJob = await SimulationJob.findById(fixture.job._id).lean();
  const updatedDecision = await Decision.findById(fixture.decision._id).lean();
  assert.equal(updatedJob.status, "pending");
  assert.equal(updatedJob.ledgerWriteMode, "upsert");
  assert.equal(updatedJob.ledgerCompletionTracking, false);
  assert.equal(updatedJob.recalculationRunId, result.recalculationRunId);
  assert.equal(updatedDecision.processingStatus, "completed");
  assert.equal(
    String(updatedDecision.ledgerEntryId),
    String(fixture.ledger._id)
  );
});

test("blocks recalculation when the student has a later ledger", async () => {
  const fixture = await createFixture();
  const laterChallenge = await Challenge.create({
    organization: fixture.organizationId,
    createdBy: "teacher",
    updatedBy: "teacher",
    classroomId: fixture.classroomId,
    title: "Challenge two",
    week: 2,
    isClosed: true,
    automationStatus: "processed",
  });
  await LedgerEntry.create({
    organization: fixture.organizationId,
    createdBy: "teacher",
    updatedBy: "teacher",
    classroomId: fixture.classroomId,
    challengeId: laterChallenge._id,
    userId: fixture.userId,
    metrics: { netProfit: 50 },
    summary: "Later result",
    aiMetadata: { model: "test", runId: "later", generatedAt: new Date() },
  });

  await assert.rejects(
    service.recalculateStudentResult({
      decision: fixture.decision,
      organizationId: fixture.organizationId,
      clerkUserId: "teacher",
    }),
    (error) => error.statusCode === 409 && /later challenge result/.test(error.message)
  );
});

test("blocks recalculation while a challenge batch is active", async () => {
  const fixture = await createFixture();
  await SimulationBatch.create({
    organization: fixture.organizationId,
    createdBy: "teacher",
    updatedBy: "teacher",
    classroomId: fixture.classroomId,
    challengeId: fixture.challenge._id,
    status: "submitted",
    jobCount: 1,
  });

  await assert.rejects(
    service.recalculateStudentResult({
      decision: fixture.decision,
      organizationId: fixture.organizationId,
      clerkUserId: "teacher",
    }),
    (error) => error.statusCode === 409 && /batch is still active/.test(error.message)
  );
});
