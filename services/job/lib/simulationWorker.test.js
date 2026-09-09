const test = require("node:test");
const assert = require("node:assert/strict");

const SimulationWorker = require("./simulationWorker");
const SimulationJob = require("../job.model");
const classroomReadinessService = require("../../classroom/classroomReadiness.service");

test("simulationWorker exports processJob", () => {
  assert.equal(typeof SimulationWorker.processJob, "function");
  assert.equal(typeof SimulationWorker.buildPriorMetrics, "function");
});

test("buildPriorMetrics treats Week 0 as the authoritative opening ledger", async () => {
  const priorMetrics = await SimulationWorker.buildPriorMetrics(
    [
      {
        challengeId: null,
        metrics: { sales: 0, cashBefore: 30000, cashAfter: 30000 },
      },
    ],
    "classroom-id"
  );

  assert.deepEqual(priorMetrics, {
    sales: 0,
    cashBefore: 30000,
    cashAfter: 30000,
  });
});

test("buildPriorMetrics carries cash from a completed challenge", async () => {
  const priorMetrics = await SimulationWorker.buildPriorMetrics(
    [
      { challengeId: null, metrics: { cashAfter: 0 } },
      {
        challengeId: "previous-challenge",
        metrics: { cashBefore: 50000, cashAfter: 51250 },
      },
    ],
    "classroom-id"
  );

  assert.deepEqual(priorMetrics, {
    cashBefore: 50000,
    cashAfter: 51250,
  });
});

test("processJob enforces readiness before running direct or queued work", async (t) => {
  const originalFindById = SimulationJob.findById;
  const originalAssert = classroomReadinessService.assertClassroomReady;
  t.after(() => {
    SimulationJob.findById = originalFindById;
    classroomReadinessService.assertClassroomReady = originalAssert;
  });

  let markedRunning = false;
  SimulationJob.findById = async () => ({
    _id: "job-id",
    status: "pending",
    dryRun: false,
    classroomId: "classroom-id",
    challengeId: "challenge-id",
    organization: "organization-id",
    markRunning: async () => {
      markedRunning = true;
    },
  });
  classroomReadinessService.assertClassroomReady = async (input) => {
    assert.equal(input.operation, "process");
    assert.deepEqual(input.ignoreCheckKeys, ["in_progress_jobs"]);
    throw new Error("readiness blocked");
  };

  await assert.rejects(SimulationWorker.processJob("job-id"), /readiness blocked/);
  assert.equal(markedRunning, false);
});

for (const outcome of ["success", "api failure", "persistence failure"]) {
  test(`individual processing persists the exact request before sending: ${outcome}`, async (t) => {
    const LedgerEntry = require("../../ledger/ledger.model");
    const openai = require("../../../lib/openai");
    const request = {
      model: "test-model",
      messages: [{ role: "system", content: "Hardened instructions" }],
      response_format: { type: "json_object" },
    };
    const rawMessages = [{ role: "system", content: "Raw instructions" }];
    let persisted = null;
    let calls = 0;
    const job = {
      _id: "job-id",
      status: "pending",
      async markRunning() { this.status = "running"; },
      async markFailed(error) { this.status = "failed"; this.error = error; },
      async save() {
        if (outcome === "persistence failure") throw new Error("save failed");
        persisted = structuredClone({
          request: this.openaiRequest,
          rawMessages: this.openaiRequestRawMessages,
          preparedAt: this.openaiRequestPreparedAt,
        });
      },
      toObject() { return { ...this }; },
    };
    t.mock.method(SimulationJob, "findById", async () => job);
    t.mock.method(classroomReadinessService, "assertClassroomReady", async () => {});
    t.mock.method(SimulationWorker, "fetchJobContext", async () => ({}));
    t.mock.method(LedgerEntry, "buildAISimulationOpenAIRequest", async () => ({ request, rawMessages }));
    t.mock.method(SimulationJob, "exists", async (query) => query.status === "running");
    t.mock.method(SimulationJob, "findOneAndUpdate", async () => ({ status: "completed", completedAt: new Date() }));
    t.mock.method(SimulationWorker, "writeLedgerEntry", async () => null);
    t.mock.method(SimulationWorker, "updateSubmissionStatus", async () => {});
    t.mock.method(SimulationWorker, "recordLedgerCompletionEvents", async () => {});
    t.mock.method(openai.chat.completions, "create", async (sent) => {
      calls += 1;
      assert.deepEqual(persisted.request, sent);
      assert.deepEqual(persisted.rawMessages, rawMessages);
      assert.ok(persisted.preparedAt instanceof Date);
      if (outcome === "api failure") throw new Error("OpenAI failed");
      return { choices: [{ message: { content: JSON.stringify({ summary: "Done" }) } }] };
    });

    if (outcome === "success") {
      const result = await SimulationWorker.processJob(job._id);
      assert.equal(result.success, true);
      assert.deepEqual(result.job.openaiRequest, request);
    } else {
      await assert.rejects(SimulationWorker.processJob(job._id),
        outcome === "api failure" ? /OpenAI failed/ : /save failed/);
      assert.equal(job.status, "failed");
    }
    assert.equal(calls, outcome === "persistence failure" ? 0 : 1);
    if (outcome === "api failure") assert.deepEqual(persisted.request, request);
  });
}
