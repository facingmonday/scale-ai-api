const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../../test/helpers/db");

const SimulationJob = require("../job.model");
const LedgerEntry = require("../../ledger/ledger.model");
const Decision = require("../../decision/decision.model");
const Challenge = require("../../challenge/challenge.model");
const MetricDefinition = require("../../metricDefinition/metricDefinition.model");
const VariableDefinition = require("../../variableDefinition/variableDefinition.model");
const Notification = require("../../notifications/notifications.model");
const SimulationWorker = require("./simulationWorker");

async function createFixture() {
  const organizationId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const challengeId = new mongoose.Types.ObjectId();
  const decisionId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();
  const base = {
    organization: organizationId,
    createdBy: "original-teacher",
    updatedBy: "original-teacher",
  };
  const challenge = await Challenge.create({
    ...base,
    _id: challengeId,
    classroomId,
    title: "Challenge",
    week: 1,
    isClosed: true,
    automationStatus: "processed",
    teacherDebrief: { status: "completed", summary: "Stale summary" },
  });
  const decision = await Decision.create({
    ...base,
    _id: decisionId,
    classroomId,
    challengeId,
    userId,
    processingStatus: "completed",
  });
  const ledger = await LedgerEntry.create({
    ...base,
    profileId,
    classroomId,
    challengeId,
    decisionId,
    userId,
    metrics: { netProfit: -500 },
    summary: "Original result",
    randomEvent: "Old event",
    aiMetadata: { model: "old", runId: "old-run", generatedAt: new Date() },
    overridden: true,
    overriddenBy: new mongoose.Types.ObjectId(),
    overriddenAt: new Date(),
  });
  decision.ledgerEntryId = ledger._id;
  await decision.save();
  const job = await SimulationJob.create({
    ...base,
    updatedBy: "requesting-teacher",
    classroomId,
    challengeId,
    decisionId,
    userId,
    status: "running",
    ledgerWriteMode: "upsert",
    recalculationRunId: "current-run",
    ledgerEntryId: ledger._id,
    ledgerCompletionTracking: false,
  });
  return { organizationId, classroomId, challenge, decision, ledger, job, profileId };
}

test.before(async () => {
  await setupTestDb();
});

test.after(async () => {
  await teardownTestDb();
});

test.beforeEach(async () => {
  await clearCollections();
});

test("upsert write preserves ledger identity and creation metadata", async (t) => {
  const fixture = await createFixture();
  const originalMetricGetActive = MetricDefinition.getActive;
  const originalFilter = VariableDefinition.filterVariablesForAIContext;
  MetricDefinition.getActive = async () => [
    { key: "netProfit" },
    { key: "cashAfter" },
  ];
  VariableDefinition.filterVariablesForAIContext = async (_classroomId, maps) =>
    maps;
  t.after(() => {
    MetricDefinition.getActive = originalMetricGetActive;
    VariableDefinition.filterVariablesForAIContext = originalFilter;
  });

  const originalCreatedDate = fixture.ledger.createdDate;
  const result = await SimulationWorker.writeLedgerEntry(
    fixture.job,
    {
      netProfit: 250,
      cashAfter: 1250,
      summary: "Replacement result",
      randomEvent: null,
      aiMetadata: {
        model: "new",
        runId: "new-run",
        generatedAt: new Date(),
        prompt: [{ role: "system", content: "test" }],
      },
    },
    {
      profile: { profileId: fixture.profileId, capacity: 20 },
      challenge: { variables: { demand: 10 } },
      decision: { variables: { inventory: 10 } },
      outcome: { variables: {} },
      priorMetrics: { cashAfter: 1000 },
      ledgerHistory: [],
    }
  );

  assert.equal(String(result._id), String(fixture.ledger._id));
  const persisted = await LedgerEntry.findById(fixture.ledger._id).lean();
  assert.equal(String(persisted._id), String(fixture.ledger._id));
  assert.equal(persisted.createdBy, "original-teacher");
  assert.equal(persisted.createdDate.getTime(), originalCreatedDate.getTime());
  assert.equal(persisted.updatedBy, "requesting-teacher");
  assert.equal(persisted.metrics.netProfit, 250);
  assert.equal(persisted.summary, "Replacement result");
  assert.equal(persisted.overridden, false);
  assert.equal(persisted.overriddenBy, null);
  assert.equal(persisted.overriddenAt, null);
  assert.equal(await Notification.countDocuments({}), 0);

  const challenge = await Challenge.findById(fixture.challenge._id)
    .select("+teacherDebrief")
    .lean();
  assert.equal(challenge.teacherDebrief, undefined);
});

test("stale run token cannot replace the ledger", async () => {
  const fixture = await createFixture();
  fixture.job.recalculationRunId = "stale-run";

  await assert.rejects(
    SimulationWorker.writeLedgerEntry(
      fixture.job,
      {
        netProfit: 999,
        summary: "Should not persist",
        aiMetadata: { model: "new", runId: "new", generatedAt: new Date() },
      },
      {
        profile: { profileId: fixture.profileId },
        challenge: {},
        decision: {},
        outcome: {},
        priorMetrics: {},
        ledgerHistory: [],
      }
    ),
    /Stale recalculation run/
  );

  const persisted = await LedgerEntry.findById(fixture.ledger._id).lean();
  assert.equal(persisted.summary, "Original result");
  assert.equal(persisted.metrics.netProfit, -500);
});

test("failed recalculation leaves the prior ledger and completed decision visible", async (t) => {
  const fixture = await createFixture();
  fixture.job.status = "pending";
  await fixture.job.save();

  const originals = {
    fetchJobContext: SimulationWorker.fetchJobContext,
    runAISimulation: LedgerEntry.runAISimulation,
    updateSubmissionStatus: SimulationWorker.updateSubmissionStatus,
    recordLedgerCompletionEvents: SimulationWorker.recordLedgerCompletionEvents,
  };
  let statusUpdateCount = 0;
  let completionEventCount = 0;
  SimulationWorker.fetchJobContext = async () => ({ classroomId: fixture.classroomId });
  LedgerEntry.runAISimulation = async () => {
    throw new Error("Temporary model failure");
  };
  SimulationWorker.updateSubmissionStatus = async () => {
    statusUpdateCount += 1;
  };
  SimulationWorker.recordLedgerCompletionEvents = async () => {
    completionEventCount += 1;
  };
  t.after(() => {
    SimulationWorker.fetchJobContext = originals.fetchJobContext;
    LedgerEntry.runAISimulation = originals.runAISimulation;
    SimulationWorker.updateSubmissionStatus = originals.updateSubmissionStatus;
    SimulationWorker.recordLedgerCompletionEvents =
      originals.recordLedgerCompletionEvents;
  });

  await assert.rejects(
    SimulationWorker.processJob(fixture.job._id, {
      isFinalAttempt: true,
      expectedRecalculationRunId: "current-run",
    }),
    /Temporary model failure/
  );

  const [persistedLedger, persistedDecision, persistedJob] = await Promise.all([
    LedgerEntry.findById(fixture.ledger._id).lean(),
    Decision.findById(fixture.decision._id).lean(),
    SimulationJob.findById(fixture.job._id).lean(),
  ]);
  assert.equal(persistedLedger.summary, "Original result");
  assert.equal(persistedLedger.metrics.netProfit, -500);
  assert.equal(persistedDecision.processingStatus, "completed");
  assert.equal(persistedJob.status, "failed");
  assert.equal(statusUpdateCount, 0);
  assert.equal(completionEventCount, 0);
});
