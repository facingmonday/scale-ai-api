const SimulationJob = require("../job.model");
const Profile = require("../../profile/profile.model");
const Challenge = require("../../challenge/challenge.model");
const Outcome = require("../../outcome/outcome.model");
const Decision = require("../../decision/decision.model");
const LedgerEntry = require("../../ledger/ledger.model");
const VariableDefinition = require("../../variableDefinition/variableDefinition.model");
const MetricDefinition = require("../../metricDefinition/metricDefinition.model");

/**
 * Simulation Worker - processes individual simulation jobs and writes
 * dynamic metric-driven ledger entries.
 */
class SimulationWorker {
  static async buildPriorMetrics(ledgerHistory, classroomId) {
    const history = Array.isArray(ledgerHistory) ? ledgerHistory : [];
    const priorChallengeEntries = history.filter(
      (entry) => entry?.challengeId !== null && entry?.challengeId !== undefined
    );
    const sourceEntry =
      priorChallengeEntries.at(-1) || history.at(-1) || null;
    let priorMetrics = {};

    if (sourceEntry) {
      const map = sourceEntry.metrics;
      priorMetrics =
        map instanceof Map
          ? Object.fromEntries(map)
          : map && typeof map === "object"
            ? { ...map }
            : {};
    } else {
      const defs = await MetricDefinition.getActive(classroomId);
      for (const def of defs) {
        if (
          def.defaultInitialValue !== null &&
          def.defaultInitialValue !== undefined
        ) {
          priorMetrics[def.key] = def.defaultInitialValue;
        }
      }
    }

    return priorMetrics;
  }

  static async processJob(jobId, options = {}) {
    const {
      isFinalAttempt = true,
      allowTerminalReconciliation = false,
    } = options;
    const job = await SimulationJob.findById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    if (job.status !== "pending") {
      if (
        allowTerminalReconciliation &&
        ["completed", "failed"].includes(job.status)
      ) {
        return this.recordLedgerCompletionEvents(job);
      }
      throw new Error(`Job is not pending: ${job.status}`);
    }

    try {
      await job.markRunning();
      const context = await this.fetchJobContext(job);
      const aiResult = await LedgerEntry.runAISimulation(context);

      if (!job.dryRun) {
        await this.writeLedgerEntry(job, aiResult, context);
      } else {
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

      await job.markCompleted();
      await this.updateSubmissionStatus(job, "completed");
      await this.recordLedgerCompletionEvents(job);

      return {
        success: true,
        job: job.toObject(),
        result: job.dryRun ? aiResult : null,
      };
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);
      if (job.status === "completed") {
        // The ledger and terminal analysis state are already durable. Let Bull
        // retry only the lifecycle reconciliation path without corrupting the
        // completed simulation status.
        throw error;
      }
      if (isFinalAttempt) {
        await job.markFailed(error.message);
        await this.updateSubmissionStatus(job, "failed").catch((err) => {
          console.error(`Error updating decision status:`, err);
        });
        await this.recordLedgerCompletionEvents(job);
      } else {
        job.status = "pending";
        job.error = error.message;
        job.startedAt = null;
        job.completedAt = null;
        await job.save();
      }
      throw error;
    }
  }

  /**
   * Fetch all required data for a job. Builds the new metric-driven context
   * shape (`profile`, `challenge`, `outcome`, `decision`, `priorMetrics`).
   */
  static async fetchJobContext(job) {
    const profile = await Profile.getStoreForSimulation(
      job.classroomId,
      job.userId
    );
    if (!profile) {
      throw new Error(
        `Profile not found for user ${job.userId} in class ${job.classroomId}`
      );
    }

    const challenge = await Challenge.getScenarioById(job.challengeId);
    if (!challenge) {
      throw new Error(`Challenge not found: ${job.challengeId}`);
    }

    const outcome = await Outcome.getOutcomeByScenario(job.challengeId);
    if (!outcome) {
      throw new Error(
        `Outcome not found for challenge ${job.challengeId}`
      );
    }

    const decision = await Decision.getSubmission(
      job.classroomId,
      job.challengeId,
      job.userId
    );
    if (!decision) {
      throw new Error(
        `Decision not found for user ${job.userId} and challenge ${job.challengeId}`
      );
    }

    const ledgerHistory = await LedgerEntry.getLedgerHistory(
      job.classroomId,
      job.userId,
      job.challengeId
    );

    const priorMetrics = await this.buildPriorMetrics(
      ledgerHistory,
      job.classroomId
    );

    return {
      profile,
      challenge,
      outcome,
      decision,
      ledgerHistory,
      priorMetrics,
    };
  }

  /**
   * Write a ledger entry from an AI result with a dynamic `metrics` map.
   */
  static async writeLedgerEntry(job, aiResult, context) {
    const organizationId = job.organization;

    const metricDefs = await MetricDefinition.getActive(job.classroomId);
    const metrics = LedgerEntry.extractMetricsFromAIResult(
      aiResult,
      metricDefs
    );

    // Collect variable maps from context, then filter by active definitions.
    const profileMetadataKeys = [
      "studentId",
      "shopName",
      "profileType",
      "profileTypeId",
      "profileTypeLabel",
      "profileTypeDescription",
      "profileDescription",
      "profileLocation",
      "profileId",
      "profileId",
      "profileType",
      "storeTypeId",
      "storeTypeLabel",
      "storeTypeDescription",
      "storeDescription",
      "storeLocation",
      "startingBalance",
      "initialStartupCost",
      "currentDetails",
      "variablesDetailed",
    ];
    const profileVariables = {};
    if (context.profile) {
      for (const [k, v] of Object.entries(context.profile)) {
        if (!profileMetadataKeys.includes(k)) profileVariables[k] = v;
      }
    }

    const profileId = context.profile?.profileId || context.profile?.profileId || null;

    const challengeVariables = {
      ...(context.challenge?.variables &&
      typeof context.challenge.variables === "object"
        ? context.challenge.variables
        : {}),
    };

    const decisionVariables =
      context.decision?.variables &&
      typeof context.decision.variables === "object"
        ? context.decision.variables
        : {};

    const outcomeVariables =
      context.outcome?.variables && typeof context.outcome.variables === "object"
        ? { ...context.outcome.variables }
        : {};

    const filtered = job.classroomId
      ? await VariableDefinition.filterVariablesForAIContext(
          job.classroomId,
          {
            profileVariables,
            challengeVariables,
            decisionVariables,
            outcomeVariables,
          },
          { challengeId: job.challengeId }
        )
      : {
          profileVariables,
          challengeVariables,
          decisionVariables,
          outcomeVariables,
        };

    const calculationContext = {
      profileVariables: filtered.profileVariables,
      challengeVariables: filtered.challengeVariables,
      decisionVariables: filtered.decisionVariables,
      outcomeVariables: filtered.outcomeVariables,
      priorMetrics: context.priorMetrics || {},
      ledgerHistorySummary: (context.ledgerHistory || []).map((entry) => ({
        challengeId: entry.challengeId?._id || entry.challengeId || null,
        challengeTitle: entry.challengeId?.title || "Initial Setup",
        metrics:
          entry.metrics instanceof Map
            ? Object.fromEntries(entry.metrics)
            : entry.metrics || {},
      })),
      prompt: aiResult.aiMetadata?.prompt
        ? JSON.stringify(aiResult.aiMetadata.prompt, null, 2)
        : null,
    };

    const ledgerInput = {
      profileId,
      classroomId: job.classroomId,
      challengeId: job.challengeId,
      decisionId: job.decisionId || null,
      userId: job.userId,
      metrics,
      randomEvent: aiResult.randomEvent,
      summary: aiResult.summary,
      aiMetadata: aiResult.aiMetadata,
      calculationContext,
    };

    const entry = await LedgerEntry.createLedgerEntry(
      ledgerInput,
      organizationId,
      job.createdBy
    );

    try {
      if (job.decisionId) {
        await Decision.updateOne(
          { _id: job.decisionId },
          { $set: { ledgerEntryId: entry._id } }
        );
      } else {
        await Decision.updateOne(
          {
            classroomId: job.classroomId,
            challengeId: job.challengeId,
            userId: job.userId,
          },
          { $set: { ledgerEntryId: entry._id } }
        );
      }
    } catch (err) {
      console.error("Failed to attach ledger entry to decision:", err);
    }

    return entry;
  }

  static async updateSubmissionStatus(job, jobStatus) {
    const SubmissionLocal = require("../../decision/decision.model");
    const decision = await SubmissionLocal.findOne({
      classroomId: job.classroomId,
      challengeId: job.challengeId,
      userId: job.userId,
    });
    if (decision) {
      await decision.updateProcessingStatus(jobStatus);
    }
  }

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

  static async processPendingJobsForScenario(challengeId) {
    const jobs = await SimulationJob.find({
      challengeId,
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

  static async recordLedgerCompletionEvents(job) {
    const LedgerCompletionEvent = require("../ledgerCompletionEvent.model");
    return LedgerCompletionEvent.recordReadyEventsForJob(job._id);
  }
}

module.exports = SimulationWorker;
