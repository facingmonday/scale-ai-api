const openai = require("../../lib/openai");
const SimulationBatch = require("./simulationBatch.model");
const Scenario = require("../scenario/scenario.model");

/**
 * Cancel any in-progress OpenAI batch for a scenario.
 * Finds the most recent batch in validating/in_progress/finalizing,
 * calls OpenAI batches.cancel, and marks the batch as cancelled locally.
 *
 * @param {string} scenarioId - Scenario ID
 * @param {Object} options - Options
 * @param {boolean} options.closeScenario - If true, close scenario and set batchProcessingStatus=cancelled (for cancel-only). Default false (used by cancel-batch-and-rerun).
 * @returns {Promise<{ cancelled: boolean, openaiBatchId?: string }>}
 */
async function cancelInProgressBatchForScenario(scenarioId, options = {}) {
  const { closeScenario = false } = options;

  const batch = await SimulationBatch.findInProgressByScenario(scenarioId);
  if (!batch || !batch.openaiBatchId) {
    return { cancelled: false };
  }

  try {
    await openai.batches.cancel(batch.openaiBatchId);
  } catch (err) {
    // Log but continue - batch may have already completed; we still mark locally
    console.warn(
      `OpenAI batch cancel failed for ${batch.openaiBatchId}:`,
      err.message
    );
  }

  const reason = closeScenario
    ? "Cancelled by admin (cancel-batch)"
    : "Cancelled by admin via cancel-batch-and-rerun";
  await batch.markCancelled(reason);

  if (closeScenario) {
    const scenario = await Scenario.findById(scenarioId);
    if (scenario && scenario.batchProcessingStatus === "processing") {
      const clerkUserId = batch.createdBy || "system";
      await scenario.setBatchProcessingStatus("cancelled", clerkUserId);
    }
  }

  return { cancelled: true, openaiBatchId: batch.openaiBatchId };
}

/**
 * Cancel any in-progress batch for a scenario and close it (no rerun).
 * Use when batch is stuck (e.g. OpenAI API degraded) and admin wants to stop processing.
 *
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<{ cancelled: boolean, openaiBatchId?: string }>}
 */
async function cancelBatchOnly(scenarioId) {
  return cancelInProgressBatchForScenario(scenarioId, { closeScenario: true });
}

module.exports = {
  cancelInProgressBatchForScenario,
  cancelBatchOnly,
};
