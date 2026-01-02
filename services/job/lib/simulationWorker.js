const SimulationJob = require("../job.model");
const Store = require("../../store/store.model");
const Scenario = require("../../scenario/scenario.model");
const ScenarioOutcome = require("../../scenarioOutcome/scenarioOutcome.model");
const Submission = require("../../submission/submission.model");
const LedgerEntry = require("../../ledger/ledger.model");

/**
 * Simulation Worker
 * Processes individual simulation jobs
 */
class SimulationWorker {
  /**
   * Process a single simulation job
   * @param {string} jobId - Job ID
   * @param {Object} [options]
   * @param {boolean} [options.isFinalAttempt=true] - If false, job will be reset to pending to allow Bull retry
   * @returns {Promise<Object>} Job result
   */
  static async processJob(jobId, options = {}) {
    const { isFinalAttempt = true } = options;
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
      const aiResult = await LedgerEntry.runAISimulation(context);

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
        // Create a safe copy for logging (without circular references)
        const logSafeResult = { ...aiResult };
        if (logSafeResult.aiMetadata) {
          logSafeResult.aiMetadata = {
            ...aiResult.aiMetadata,
            aiResult: "[Circular Reference Removed]",
            prompt: "[Prompt Removed for Logging]",
          };
        }
        console.log(
          `Writing ledger entry: ${JSON.stringify(logSafeResult, null, 2)}`
        );
        await this.writeLedgerEntry(job, aiResult, context);
      } else {
        // Create a safe copy for logging (without circular references)
        const logSafeResult = { ...aiResult };
        if (logSafeResult.aiMetadata) {
          logSafeResult.aiMetadata = {
            ...aiResult.aiMetadata,
            aiResult: "[Circular Reference Removed]",
            prompt: "[Prompt Removed for Logging]",
          };
        }
        console.log(`Dry run: ${JSON.stringify(logSafeResult, null, 2)}`);
      }

      // Mark job as completed
      await job.markCompleted();

      // Update submission status
      await this.updateSubmissionStatus(job, "completed");

      return {
        success: true,
        job: job.toObject(),
        result: job.dryRun ? aiResult : null, // Return result for dry runs
      };
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);

      if (isFinalAttempt) {
        // Mark job as failed (only when retries are exhausted)
        await job.markFailed(error.message);

        // Update submission status
        await this.updateSubmissionStatus(job, "failed").catch((err) => {
          console.error(`Error updating submission status:`, err);
        });
      } else {
        // Reset job back to pending so Bull can retry it.
        // Keep the latest error for visibility.
        job.status = "pending";
        job.error = error.message;
        job.startedAt = null;
        job.completedAt = null;
        await job.save();
        // Do NOT mark submission failed; it should remain "processing" while retries are in-flight.
      }

      throw error;
    }
  }

  /**
   * Fetch all required data for a job
   * @param {Object} job - Job document
   * @returns {Promise<Object>} Context object
   */
  static async fetchJobContext(job) {
    // Fetch store (use getStoreForSimulation to get flattened structure for AI)
    const store = await Store.getStoreForSimulation(
      job.classroomId,
      job.userId
    );
    if (!store) {
      throw new Error(
        `Store not found for user ${job.userId} in class ${job.classroomId}`
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
      job.classroomId,
      job.scenarioId,
      job.userId
    );
    if (!submission) {
      throw new Error(
        `Submission not found for user ${job.userId} and scenario ${job.scenarioId}`
      );
    }

    // Fetch ledger history (prior entries, excluding current scenario for reruns)
    const ledgerHistory = await LedgerEntry.getLedgerHistory(
      job.classroomId,
      job.userId,
      job.scenarioId // Exclude current scenario to avoid including old entries during reruns
    );

    // Determine cashBefore and inventoryState from ledger history
    // startingBalance is now in variables, but getStoreForSimulation flattens it
    let cashBefore = store.startingBalance || 0;
    let inventoryState = {
      refrigeratedUnits: 0,
      ambientUnits: 0,
      notForResaleUnits: 0,
    };
    if (ledgerHistory.length > 0) {
      // Get the most recent ledger entry
      const lastEntry = ledgerHistory[ledgerHistory.length - 1];
      cashBefore = lastEntry.cashAfter;
      // Get inventoryState from last entry, or use defaults if not present (for backward compatibility)
      if (lastEntry.inventoryState) {
        inventoryState = {
          refrigeratedUnits: lastEntry.inventoryState.refrigeratedUnits || 0,
          ambientUnits: lastEntry.inventoryState.ambientUnits || 0,
          notForResaleUnits: lastEntry.inventoryState.notForResaleUnits || 0,
        };
      }
    } else {
      // For initial entries, use starting inventory from store preset
      // Handle both number (legacy) and object (new bucket-based) formats
      const startingInventory = store.startingInventory || 0;

      // Normalize to object format
      if (
        typeof startingInventory === "object" &&
        startingInventory !== null &&
        !Array.isArray(startingInventory)
      ) {
        inventoryState = {
          refrigeratedUnits: startingInventory.refrigeratedUnits || 0,
          ambientUnits: startingInventory.ambientUnits || 0,
          notForResaleUnits: startingInventory.notForResaleUnits || 0,
        };
      } else {
        // Legacy number format: all inventory in refrigerated
        inventoryState = {
          refrigeratedUnits: Number(startingInventory) || 0,
          ambientUnits: 0,
          notForResaleUnits: 0,
        };
      }
    }

    return {
      store,
      scenario,
      scenarioOutcome,
      submission,
      ledgerHistory,
      cashBefore,
      inventoryState,
    };
  }

  /**
   * Write ledger entry from AI result
   * @param {Object} job - Job document
   * @param {Object} aiResult - AI simulation result
   * @param {Object} context - Calculation context (store, scenario, submission, etc.)
   * @returns {Promise<Object>} Created ledger entry
   */
  static async writeLedgerEntry(job, aiResult, context) {
    // Get organization from job
    const organizationId = job.organization;

    // Extract variables from each context object
    // Store: getStoreForSimulation returns flattened object, variables are at top level
    // We need to extract only variable keys (exclude store metadata like shopName, storeType, etc.)
    const storeMetadataKeys = [
      "shopName",
      "storeType",
      "storeTypeId",
      "storeDescription",
      "storeLocation",
      "startingBalance",
      "currentDetails",
      "variablesDetailed",
    ];
    const storeVariables = {};
    if (context.store) {
      Object.keys(context.store).forEach((key) => {
        if (!storeMetadataKeys.includes(key)) {
          storeVariables[key] = context.store[key];
        }
      });
    }

    // Scenario: variables are in .variables property (from plugin)
    const scenarioVariables =
      context.scenario?.variables &&
      typeof context.scenario.variables === "object"
        ? context.scenario.variables
        : {};

    // Submission: variables are in .variables property (from plugin)
    const submissionVariables =
      context.submission?.variables &&
      typeof context.submission.variables === "object"
        ? context.submission.variables
        : {};

    // Outcome: may have variables, plus random event chance + notes
    const outcomeVariables =
      context.scenarioOutcome?.variables &&
      typeof context.scenarioOutcome.variables === "object"
        ? context.scenarioOutcome.variables
        : {};
    // Also include outcome metadata
    if (context.scenarioOutcome) {
      if (context.scenarioOutcome.randomEventChancePercent !== undefined) {
        outcomeVariables.randomEventChancePercent =
          context.scenarioOutcome.randomEventChancePercent;
      }
      if (context.scenarioOutcome.notes) {
        outcomeVariables.notes = context.scenarioOutcome.notes;
      }
    }

    // Prepare calculation context for storage
    const calculationContext = {
      storeVariables,
      scenarioVariables,
      submissionVariables,
      outcomeVariables,
      priorState: {
        cashBefore: context.cashBefore,
        inventoryState: context.inventoryState || {
          refrigeratedUnits: 0,
          ambientUnits: 0,
          notForResaleUnits: 0,
        },
        ledgerHistory: (context.ledgerHistory || []).map((entry) => ({
          scenarioId: entry.scenarioId?._id || entry.scenarioId || null,
          scenarioTitle: entry.scenarioId?.title || "Initial Setup",
          netProfit: entry.netProfit,
          cashAfter: entry.cashAfter,
          inventoryState: entry.inventoryState || {
            refrigeratedUnits: 0,
            ambientUnits: 0,
            notForResaleUnits: 0,
          },
        })),
      },
      prompt: aiResult.aiMetadata?.prompt
        ? JSON.stringify(aiResult.aiMetadata.prompt, null, 2)
        : null,
    };

    // Prepare ledger entry input
    const ledgerInput = {
      classroomId: job.classroomId,
      scenarioId: job.scenarioId,
      submissionId: job.submissionId || null,
      userId: job.userId,
      sales: aiResult.sales,
      revenue: aiResult.revenue,
      costs: aiResult.costs,
      waste: aiResult.waste,
      cashBefore: aiResult.cashBefore,
      cashAfter: aiResult.cashAfter,
      inventoryState: aiResult.inventoryState || {
        refrigeratedUnits: 0,
        ambientUnits: 0,
        notForResaleUnits: 0,
      },
      netProfit: aiResult.netProfit,
      randomEvent: aiResult.randomEvent,
      summary: aiResult.summary,
      education: aiResult.education,
      aiMetadata: aiResult.aiMetadata,
      calculationContext,
    };

    // Create ledger entry
    const entry = await LedgerEntry.createLedgerEntry(
      ledgerInput,
      organizationId,
      job.createdBy
    );

    // Attach ledger entry to submission (if available)
    try {
      if (job.submissionId) {
        await Submission.updateOne(
          { _id: job.submissionId },
          {
            $set: { ledgerEntryId: entry._id },
          }
        );
      } else {
        // Fallback for older jobs without submissionId
        await Submission.updateOne(
          {
            classroomId: job.classroomId,
            scenarioId: job.scenarioId,
            userId: job.userId,
          },
          {
            $set: { ledgerEntryId: entry._id },
          }
        );
      }
    } catch (err) {
      console.error("Failed to attach ledger entry to submission:", err);
      // Don't throw - ledger entry creation succeeded
    }

    return entry;
  }

  /**
   * Update submission status based on job status
   * @param {Object} job - Job document
   * @param {string} jobStatus - Job status ("completed" or "failed")
   * @returns {Promise<void>}
   */
  static async updateSubmissionStatus(job, jobStatus) {
    const Submission = require("../../submission/submission.model");

    const submission = await Submission.findOne({
      classroomId: job.classroomId,
      scenarioId: job.scenarioId,
      userId: job.userId,
    });

    if (submission) {
      await submission.updateProcessingStatus(jobStatus);
    }
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

  /**
   * Process all pending jobs for a specific scenario
   * @param {string} scenarioId - Scenario ID
   * @returns {Promise<Array>} Array of results
   */
  static async processPendingJobsForScenario(scenarioId) {
    const jobs = await SimulationJob.find({
      scenarioId,
      status: "pending",
    }).sort({ createdDate: 1 });

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
