const SimulationJob = require("../job.model");
const Store = require("../../store/store.model");
const Scenario = require("../../scenario/scenario.model");
const ScenarioOutcome = require("../../scenarioOutcome/scenarioOutcome.model");
const Submission = require("../../submission/submission.model");
const LedgerService = require("../../ledger/lib/ledgerService");
const AISimulationService = require("../../ledger/lib/aiSimulationService");

/**
 * Simulation Worker
 * Processes individual simulation jobs
 */
class SimulationWorker {
  /**
   * Process a single simulation job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job result
   */
  static async processJob(jobId) {
    const job = await SimulationJob.findById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== "pending") {
      throw new Error(`Job is not pending: ${job.status}`);
    }

    try {
      // Mark job as running
      await job.markRunning();

      // Fetch required data
      const context = await this.fetchJobContext(job);

      // Run AI simulation
      const aiResult = await AISimulationService.runSimulation(context);

      // Validate and correct cashBefore if needed
      // The AI should calculate this from ledger history, but we ensure continuity
      const expectedCashBefore = context.cashBefore;
      if (Math.abs(aiResult.cashBefore - expectedCashBefore) > 0.01) {
        console.warn(
          `AI cashBefore (${aiResult.cashBefore}) doesn't match expected (${expectedCashBefore}). Correcting...`
        );
        // Adjust cashAfter to maintain continuity
        const adjustment = expectedCashBefore - aiResult.cashBefore;
        aiResult.cashBefore = expectedCashBefore;
        aiResult.cashAfter = aiResult.cashAfter + adjustment;
        // Recalculate netProfit to maintain cash continuity
        aiResult.netProfit = aiResult.cashAfter - aiResult.cashBefore;
      }

      // If not a dry run, write to ledger
      if (!job.dryRun) {
        await this.writeLedgerEntry(job, aiResult, context.scenario.week);
      }

      // Mark job as completed
      await job.markCompleted();

      return {
        success: true,
        job: job.toObject(),
        result: job.dryRun ? aiResult : null, // Return result for dry runs
      };
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);

      // Mark job as failed
      await job.markFailed(error.message);

      throw error;
    }
  }

  /**
   * Fetch all required data for a job
   * @param {Object} job - Job document
   * @returns {Promise<Object>} Context object
   */
  static async fetchJobContext(job) {
    // Fetch store
    const store = await Store.getStoreByUser(job.classId, job.userId);
    if (!store) {
      throw new Error(
        `Store not found for user ${job.userId} in class ${job.classId}`
      );
    }

    // Fetch scenario with variables populated
    const scenario = await Scenario.getScenarioById(job.scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${job.scenarioId}`);
    }

    // Fetch scenario outcome
    const scenarioOutcome = await ScenarioOutcome.getOutcomeByScenario(
      job.scenarioId
    );
    if (!scenarioOutcome) {
      throw new Error(
        `Scenario outcome not found for scenario ${job.scenarioId}`
      );
    }

    // Fetch submission
    const submission = await Submission.getSubmission(
      job.classId,
      job.scenarioId,
      job.userId
    );
    if (!submission) {
      throw new Error(
        `Submission not found for user ${job.userId} and scenario ${job.scenarioId}`
      );
    }

    // Fetch ledger history (prior weeks, excluding current scenario for reruns)
    const ledgerHistory = await LedgerService.getLedgerHistory(
      job.classId,
      job.userId,
      job.scenarioId // Exclude current scenario to avoid including old entries during reruns
    );

    // Determine cashBefore from ledger history
    let cashBefore = store.startingBalance;
    if (ledgerHistory.length > 0) {
      // Get the most recent ledger entry
      const lastEntry = ledgerHistory[ledgerHistory.length - 1];
      cashBefore = lastEntry.cashAfter;
    }

    return {
      store,
      scenario,
      scenarioOutcome,
      submission,
      ledgerHistory,
      cashBefore,
    };
  }

  /**
   * Write ledger entry from AI result
   * @param {Object} job - Job document
   * @param {Object} aiResult - AI simulation result
   * @param {number} week - Week number
   * @returns {Promise<Object>} Created ledger entry
   */
  static async writeLedgerEntry(job, aiResult, week) {
    // Get organization from job
    const organizationId = job.organization;

    // Prepare ledger entry input
    const ledgerInput = {
      classId: job.classId,
      scenarioId: job.scenarioId,
      userId: job.userId,
      week: week,
      sales: aiResult.sales,
      revenue: aiResult.revenue,
      costs: aiResult.costs,
      waste: aiResult.waste,
      cashBefore: aiResult.cashBefore,
      cashAfter: aiResult.cashAfter,
      inventoryBefore: aiResult.inventoryBefore,
      inventoryAfter: aiResult.inventoryAfter,
      netProfit: aiResult.netProfit,
      randomEvent: aiResult.randomEvent,
      summary: aiResult.summary,
      aiMetadata: aiResult.aiMetadata,
    };

    // Create ledger entry
    return await LedgerService.createLedgerEntry(
      ledgerInput,
      organizationId,
      job.createdBy
    );
  }

  /**
   * Process multiple pending jobs
   * @param {number} limit - Maximum number of jobs to process
   * @returns {Promise<Array>} Array of results
   */
  static async processPendingJobs(limit = 10) {
    const jobs = await SimulationJob.getPendingJobs(limit);
    const results = [];

    for (const job of jobs) {
      try {
        const result = await this.processJob(job._id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process job ${job._id}:`, error);
        results.push({
          success: false,
          jobId: job._id,
          error: error.message,
        });
      }
    }

    return results;
  }
}

module.exports = SimulationWorker;
