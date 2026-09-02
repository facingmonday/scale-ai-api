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
