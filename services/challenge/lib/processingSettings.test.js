const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getProcessingSettings,
  validateProcessingSettings,
} = require("./processingSettings");

test("creation defaults and legacy defaults are independent of environment variables", () => {
  assert.deepEqual(validateProcessingSettings({}), {
    simulationMode: "direct",
    simulationConcurrency: 5,
  });
  assert.deepEqual(getProcessingSettings({}), {
    simulationMode: "batch",
    simulationConcurrency: 5,
  });
  assert.deepEqual(
    getProcessingSettings({
      simulationMode: "direct",
      simulationConcurrency: 2,
    }),
    { simulationMode: "direct", simulationConcurrency: 2 },
  );
});

test("settings reject invalid modes and non-integer or out-of-range concurrency", () => {
  for (const simulationMode of ["", "DIRECT", "other", null, 5]) {
    assert.throws(() => validateProcessingSettings({ simulationMode }), {
      statusCode: 400,
    });
  }
  for (const simulationConcurrency of [0, 21, -1, 1.5, "5", null, NaN]) {
    assert.throws(() => validateProcessingSettings({ simulationConcurrency }), {
      statusCode: 400,
    });
  }
  assert.deepEqual(
    validateProcessingSettings({ simulationMode: "batch" }, { partial: true }),
    { simulationMode: "batch" },
  );
});
