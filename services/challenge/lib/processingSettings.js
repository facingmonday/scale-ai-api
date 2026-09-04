const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 20;

function validateProcessingSettings(input, { partial = false } = {}) {
  const result = {};
  if (!partial || input.simulationMode !== undefined) {
    const mode =
      input.simulationMode === undefined ? "direct" : input.simulationMode;
    if (!["direct", "batch"].includes(mode)) {
      throw Object.assign(new Error("simulationMode must be direct or batch"), {
        statusCode: 400,
      });
    }
    result.simulationMode = mode;
  }
  if (!partial || input.simulationConcurrency !== undefined) {
    const concurrency =
      input.simulationConcurrency === undefined
        ? DEFAULT_CONCURRENCY
        : input.simulationConcurrency;
    if (
      !Number.isInteger(concurrency) ||
      concurrency < 1 ||
      concurrency > MAX_CONCURRENCY
    ) {
      throw Object.assign(
        new Error("simulationConcurrency must be an integer from 1 to 20"),
        { statusCode: 400 },
      );
    }
    result.simulationConcurrency = concurrency;
  }
  return result;
}

// Older stored challenges intentionally retain Batch until explicitly changed.
function getProcessingSettings(challenge) {
  return {
    simulationMode: challenge.simulationMode || "batch",
    simulationConcurrency:
      challenge.simulationConcurrency || DEFAULT_CONCURRENCY,
  };
}

module.exports = {
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
  validateProcessingSettings,
  getProcessingSettings,
};
