const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const SimulationJob = require("./job.model");
const LedgerEntry = require("../ledger/ledger.model");
const LedgerCompletionEvent = require("./ledgerCompletionEvent.model");
const AutomationTask = require("../ai/automationTask.model");

before(async () => {
  await setupTestDb();
  await LedgerCompletionEvent.syncIndexes();
});

after(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

async function createChallengeFixture({
  withDecision = true,
  feedbackReleaseMode = "MANUAL",
  dryRun = false,
} = {}) {
  const organization = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const challenge = await Challenge.create({
    classroomId,
    title: "Ledger completion test",
    feedbackReleaseMode,
    organization,
    createdBy: "test-admin",
    updatedBy: "test-admin",
  });

  if (!withDecision) {
    return { organization, classroomId, userId, challenge };
  }

  const decision = await Decision.create({
    classroomId,
    challengeId: challenge._id,
    userId,
    processingStatus: "processing",
    organization,
    createdBy: "test-student",
    updatedBy: "test-student",
  });
  const job = await SimulationJob.createJob(
    {
      classroomId,
      challengeId: challenge._id,
      decisionId: decision._id,
      userId,
      dryRun,
    },
    organization,
    "test-admin",
  );
  return { organization, classroomId, userId, challenge, decision, job };
}

test("rejects failed and dry-run jobs from aggregate completion", async () => {
  const failed = await createChallengeFixture();
  await failed.challenge.beginResultCalculation("test-admin");
  await failed.job.markFailed("simulation failed");

  let result = await LedgerCompletionEvent.recordChallengeLedgersComplete(
    failed.challenge._id,
    { enqueue: false },
  );
  assert.equal(result.ready, false);
  assert.equal(result.reason, "analysis-failed");
  assert.equal(await LedgerCompletionEvent.countDocuments(), 0);

  await clearCollections();
  const preview = await createChallengeFixture({ dryRun: true });
  await preview.challenge.beginResultCalculation("test-admin");
  await preview.job.markCompleted();
  await writeLedger(preview);

  result = await LedgerCompletionEvent.recordChallengeLedgersComplete(
    preview.challenge._id,
    { enqueue: false },
  );
  assert.equal(result.ready, false);
  assert.equal(result.reason, "dry-run-job");
  assert.equal(await LedgerCompletionEvent.countDocuments(), 0);
});

test("requires the single ledger to belong to the matching Decision", async () => {
  const fixture = await createChallengeFixture();
  await fixture.challenge.beginResultCalculation("test-admin");
  await fixture.job.markCompleted();
  const ledger = await writeLedger(fixture);
  ledger.decisionId = new mongoose.Types.ObjectId();
  await ledger.save();

  const result = await LedgerCompletionEvent.recordChallengeLedgersComplete(
    fixture.challenge._id,
    { enqueue: false },
  );
  assert.equal(result.ready, false);
  assert.equal(result.reason, "decision-ledger-mismatch");
  assert.equal(await LedgerCompletionEvent.countDocuments(), 0);
});

async function writeLedger(fixture) {
  return LedgerEntry.create({
    classroomId: fixture.classroomId,
    challengeId: fixture.challenge._id,
    decisionId: fixture.decision._id,
    userId: fixture.userId,
    metrics: { profit: 42 },
    summary: "Durably written result",
    aiMetadata: {
      model: "test-model",
      runId: `run-${fixture.decision._id}`,
      generatedAt: new Date(),
    },
    organization: fixture.organization,
    createdBy: "test-admin",
    updatedBy: "test-admin",
  });
}

test("does not record aggregate completion before terminal analysis and ledger persistence", async () => {
  const fixture = await createChallengeFixture();
  await fixture.challenge.beginResultCalculation("test-admin");

  let persistedChallenge = await Challenge.findById(fixture.challenge._id);
  assert.equal(persistedChallenge.isClosed, true);
  assert.equal(persistedChallenge.automationStatus, "processing");
  assert.equal(persistedChallenge.automatedProcessedAt, null);

  let result = await LedgerCompletionEvent.recordChallengeLedgersComplete(
    fixture.challenge._id,
    { enqueue: false },
  );
  assert.equal(result.ready, false);
  assert.equal(result.reason, "analysis-not-terminal");
  assert.equal(await LedgerCompletionEvent.countDocuments(), 0);

  await fixture.job.markCompleted();
  result = await LedgerCompletionEvent.recordChallengeLedgersComplete(
    fixture.challenge._id,
    { enqueue: false },
  );
  assert.equal(result.ready, false);
  assert.equal(result.reason, "ledger-not-written");
  assert.equal(await LedgerCompletionEvent.countDocuments(), 0);

  await writeLedger(fixture);
  const concurrent = await Promise.all(
    Array.from({ length: 5 }, () =>
      LedgerCompletionEvent.recordChallengeLedgersComplete(
        fixture.challenge._id,
        { enqueue: false },
      ),
    ),
  );
  assert.ok(concurrent.every((item) => item.ready));
  assert.equal(
    await LedgerCompletionEvent.countDocuments({
      eventType: "CHALLENGE_LEDGERS_COMPLETE",
    }),
    1,
  );
  persistedChallenge = await Challenge.findById(fixture.challenge._id);
  assert.equal(persistedChallenge.automationStatus, "processed");
  assert.equal(persistedChallenge.isFeedbackReleased, false);
  assert.ok(persistedChallenge.automatedProcessedAt instanceof Date);
});

test("records one student event only after that student's ledger exists", async () => {
  const fixture = await createChallengeFixture();
  await fixture.job.markCompleted();

  let result = await LedgerCompletionEvent.recordStudentLedgerComplete(
    fixture.job._id,
    { enqueue: false },
  );
  assert.equal(result.ready, false);
  assert.equal(result.reason, "ledger-not-written");

  await writeLedger(fixture);
  await Promise.all(
    Array.from({ length: 4 }, () =>
      LedgerCompletionEvent.recordStudentLedgerComplete(fixture.job._id, {
        enqueue: false,
      }),
    ),
  );

  const events = await LedgerCompletionEvent.find({
    eventType: "STUDENT_LEDGER_COMPLETE",
  }).lean();
  assert.equal(events.length, 1);
  assert.equal(String(events[0].decisionId), String(fixture.decision._id));
  assert.equal(String(events[0].userId), String(fixture.userId));
});

test("deliberately records a zero-submission aggregate completion event", async () => {
  const fixture = await createChallengeFixture({
    withDecision: false,
    feedbackReleaseMode: "IMMEDIATE",
  });
  await fixture.challenge.beginResultCalculation("test-admin");
  const result = await LedgerCompletionEvent.recordChallengeLedgersComplete(
    fixture.challenge._id,
    { enqueue: false },
  );

  assert.equal(result.ready, true);
  assert.equal(result.reason, "no-submissions");
  assert.equal(result.event.expectedDecisionCount, 0);
  assert.equal(await LedgerCompletionEvent.countDocuments(), 1);
  const persistedChallenge = await Challenge.findById(fixture.challenge._id);
  assert.equal(persistedChallenge.automationStatus, "feedbackReleased");
  assert.equal(persistedChallenge.isFeedbackReleased, true);
});

test("failed event dispatch remains observable and succeeds on retry", async () => {
  const fixture = await createChallengeFixture({ withDecision: false });
  const { event } =
    await LedgerCompletionEvent.recordChallengeLedgersComplete(
      fixture.challenge._id,
      { enqueue: false },
    );

  const originalTrigger = AutomationTask.trigger;
  let triggerAttempts = 0;
  AutomationTask.trigger = async () => {
    triggerAttempts += 1;
    if (triggerAttempts === 1) throw new Error("temporary automation failure");
    return { success: true, count: 0 };
  };

  try {
    await assert.rejects(
      LedgerCompletionEvent.dispatchEvent(event._id),
      /temporary automation failure/,
    );
    let persisted = await LedgerCompletionEvent.findById(event._id).lean();
    assert.equal(persisted.status, "failed");
    assert.equal(persisted.attempts, 1);
    assert.match(persisted.error, /temporary automation failure/);
    const challengeAfterFirstDispatch = await Challenge.findById(
      fixture.challenge._id,
    ).select("+teacherDebrief");
    assert.equal(challengeAfterFirstDispatch.teacherDebrief.status, "completed");

    const result = await LedgerCompletionEvent.dispatchEvent(event._id);
    assert.equal(result.success, true);
    assert.equal(result.debrief.skipped, true);
    persisted = await LedgerCompletionEvent.findById(event._id).lean();
    assert.equal(persisted.status, "completed");
    assert.equal(persisted.attempts, 2);
    assert.equal(triggerAttempts, 2);
  } finally {
    AutomationTask.trigger = originalTrigger;
  }
});
