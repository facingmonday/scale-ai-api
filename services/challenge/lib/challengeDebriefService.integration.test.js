const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../../test/helpers/db");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const Challenge = require("../challenge.model");
const Decision = require("../../decision/decision.model");
const SimulationJob = require("../../job/job.model");
const LedgerEntry = require("../../ledger/ledger.model");
const MetricDefinition = require("../../metricDefinition/metricDefinition.model");
const ProfileType = require("../../profileType/profileType.model");
const LedgerCompletionEvent = require("../../job/ledgerCompletionEvent.model");
const {
  NO_RESULTS_SUMMARY,
  generateChallengeDebrief,
  resetChallengeDebriefForRerun,
} = require("./challengeDebriefService");

before(async () => {
  ProfileType.schema.set("autoIndex", false);
  await setupTestDb();
  await LedgerCompletionEvent.syncIndexes();
});
after(teardownTestDb);
beforeEach(clearCollections);

async function createClosedChallenge() {
  const organization = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const challenge = await Challenge.create({
    classroomId,
    title: "Debrief test",
    isClosed: true,
    organization,
    createdBy: "teacher",
    updatedBy: "teacher",
  });
  return { organization, classroomId, challenge };
}

test("stores a hidden no-results placeholder without calling OpenAI", async () => {
  const fixture = await createClosedChallenge();
  let calls = 0;
  const openaiClient = {
    chat: { completions: { create: async () => { calls += 1; } } },
  };

  const result = await generateChallengeDebrief({
    challengeId: fixture.challenge._id,
    organizationId: fixture.organization,
    openaiClient,
  });

  assert.equal(calls, 0);
  assert.equal(result.teacherDebrief.status, "completed");
  assert.equal(result.teacherDebrief.summary, NO_RESULTS_SUMMARY);
  assert.ok(result.teacherDebrief.generatedAt instanceof Date);
  assert.equal(
    (await Challenge.findById(fixture.challenge._id).lean()).teacherDebrief,
    undefined,
  );
  const selected = await Challenge.findById(fixture.challenge._id).select(
    "+teacherDebrief",
  ).lean();
  assert.equal(selected.teacherDebrief.summary, NO_RESULTS_SUMMARY);
});

test("makes one anonymous request per attempt, replaces, and recovers after failure", async () => {
  const fixture = await createClosedChallenge();
  const userId = new mongoose.Types.ObjectId();
  const decision = await Decision.create({
    classroomId: fixture.classroomId,
    challengeId: fixture.challenge._id,
    userId,
    organization: fixture.organization,
    createdBy: "student@example.test",
    updatedBy: "student@example.test",
  });
  const job = await SimulationJob.createJob(
    {
      classroomId: fixture.classroomId,
      challengeId: fixture.challenge._id,
      decisionId: decision._id,
      userId,
    },
    fixture.organization,
    "teacher",
  );
  await job.markCompleted();
  await MetricDefinition.createDefinition(
    fixture.classroomId,
    {
      key: "profit",
      label: "Profit",
      dataType: "number",
      displayIn: { leaderboard: true },
    },
    fixture.organization,
    "teacher",
  );
  await LedgerEntry.create({
    classroomId: fixture.classroomId,
    challengeId: fixture.challenge._id,
    decisionId: decision._id,
    userId,
    metrics: { profit: 42 },
    summary: "FULL PRIVATE LEDGER SUMMARY",
    randomEvent: "PRIVATE RANDOM EVENT",
    calculationContext: {
      prompt: "PRIVATE CHALLENGE PROMPT",
      decisionVariables: { price: 5 },
    },
    aiMetadata: { model: "test", runId: "run-1", generatedAt: new Date() },
    organization: fixture.organization,
    createdBy: "student@example.test",
    updatedBy: "student@example.test",
  });

  const requests = [];
  const openaiClient = {
    chat: {
      completions: {
        create: async (request) => {
          requests.push(request);
          if (requests.length === 3) {
            throw new Error("temporary OpenAI failure");
          }
          const content =
            requests.length === 1
              ? "A concise cohort debrief."
              : requests.length === 2
                ? "A regenerated cohort debrief."
                : "A recovered cohort debrief.";
          return { choices: [{ message: { content } }] };
        },
      },
    },
  };

  const first = await generateChallengeDebrief({
    challengeId: fixture.challenge._id,
    organizationId: fixture.organization,
    openaiClient,
  });
  const second = await generateChallengeDebrief({
    challengeId: fixture.challenge._id,
    organizationId: fixture.organization,
    openaiClient,
  });
  const regenerated = await generateChallengeDebrief({
    challengeId: fixture.challenge._id,
    organizationId: fixture.organization,
    force: true,
    openaiClient,
  });
  await assert.rejects(
    generateChallengeDebrief({
      challengeId: fixture.challenge._id,
      organizationId: fixture.organization,
      force: true,
      openaiClient,
    }),
    /temporary OpenAI failure/,
  );
  const failed = await Challenge.findById(fixture.challenge._id).select(
    "+teacherDebrief",
  ).lean();
  assert.equal(failed.teacherDebrief.status, "failed");
  assert.match(failed.teacherDebrief.error, /temporary OpenAI failure/);
  const recovered = await generateChallengeDebrief({
    challengeId: fixture.challenge._id,
    organizationId: fixture.organization,
    openaiClient,
  });

  assert.equal(requests.length, 4);
  assert.equal(first.teacherDebrief.summary, "A concise cohort debrief.");
  assert.equal(second.skipped, true);
  assert.equal(
    regenerated.teacherDebrief.summary,
    "A regenerated cohort debrief.",
  );
  assert.equal(recovered.teacherDebrief.summary, "A recovered cohort debrief.");
  assert.equal(recovered.teacherDebrief.attempts, 4);
  const payload = JSON.stringify(requests);
  for (const forbidden of [
    String(userId),
    "student@example.test",
    "FULL PRIVATE LEDGER SUMMARY",
    "PRIVATE RANDOM EVENT",
    "PRIVATE CHALLENGE PROMPT",
  ]) {
    assert.equal(payload.includes(forbidden), false);
  }
});

test("rerun reset removes the debrief and fixed completion event", async () => {
  const fixture = await createClosedChallenge();
  await generateChallengeDebrief({
    challengeId: fixture.challenge._id,
    organizationId: fixture.organization,
    openaiClient: { chat: { completions: { create: async () => null } } },
  });
  await LedgerCompletionEvent.recordChallengeLedgersComplete(
    fixture.challenge._id,
    { enqueue: false },
  );

  await resetChallengeDebriefForRerun({
    challengeId: fixture.challenge._id,
    organizationId: fixture.organization,
  });

  const challenge = await Challenge.findById(fixture.challenge._id).select(
    "+teacherDebrief",
  ).lean();
  assert.equal(challenge.teacherDebrief, undefined);
  assert.equal(await LedgerCompletionEvent.countDocuments(), 0);
});
