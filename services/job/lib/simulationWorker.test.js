const test = require("node:test");
const assert = require("node:assert/strict");

const SimulationWorker = require("./simulationWorker");

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
