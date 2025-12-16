const SimulationWorker = require("./simulationWorker");

/**
 * Simulation Job Worker
 * Background worker for processing simulation jobs
 * Can be called periodically via cron or manually
 */
class SimulationJobWorker {
  /**
   * Process pending simulation jobs
   * @param {number} limit - Maximum number of jobs to process
   * @returns {Promise<Object>} Processing result
   */
  static async processPendingJobs(limit = 10) {
    try {
      const results = await SimulationWorker.processPendingJobs(limit);
      
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      return {
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        results,
      };
    } catch (error) {
      console.error("Error in simulation job worker:", error);
      return {
        success: false,
        error: error.message,
        processed: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }
  }
}

module.exports = SimulationJobWorker;

