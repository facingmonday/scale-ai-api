const openai = require("../../lib/openai");
const SimulationBatch = require("./simulationBatch.model");

/**
 * Cancel any in-progress OpenAI batch for a challenge.
 * Finds the most recent batch in validating/in_progress/finalizing,
 * calls OpenAI batches.cancel, and marks the batch as cancelled locally.
 *
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<{ cancelled: boolean, openaiBatchId?: string }>}
 */
async function cancelInProgressBatchForScenario(challengeId) {
  const batch = await SimulationBatch.findInProgressByScenario(challengeId);
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

  await batch.markCancelled("Cancelled by admin via cancel-batch-and-rerun");

  return { cancelled: true, openaiBatchId: batch.openaiBatchId };
}

module.exports = {
  cancelInProgressBatchForScenario,
};
