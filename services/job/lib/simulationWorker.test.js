const test = require("node:test");
const assert = require("node:assert/strict");

const SimulationWorker = require("./simulationWorker");

test("simulationWorker exports processJob", () => {
  assert.equal(typeof SimulationWorker.processJob, "function");
});
