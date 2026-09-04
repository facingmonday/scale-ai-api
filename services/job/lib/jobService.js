const SimulationJob = require("../job.model");
const { queues, ensureQueueReady } = require("../../../lib/queues");

/**
 * Job Service
 * Handles job creation and management
 */
class JobService {
  /**
   * Create a simulation job
   * @param {Object} params - All inputs needed to create/enqueue a job
   * @param {string} params.classroomId
   * @param {string} params.challengeId
   * @param {string} params.userId
   * @param {boolean} [params.dryRun]
   * @param {string|null} [params.decisionId] - Optional decision ID to link job to
   * @param {string} params.organizationId
   * @param {string} params.clerkUserId
   * @returns {Promise<Object>} Created job
   */
  static async createJob(params) {
    const {
      organizationId,
      clerkUserId,
      decisionId = null,
      enqueue = true,
      ...input
    } = params;

    const job = await SimulationJob.createJob(
      {
        ...input,
        decisionId,
      },
      organizationId,
      clerkUserId,
    );

    // Link job to decision if decision exists
    try {
      const Decision = require("../../decision/decision.model");
      if (decisionId) {
        // Avoid fetching the decision: link job via atomic update.
        const r1 = await Decision.updateOne(
          { _id: decisionId },
          {
            $set: {
              processingStatus: ["completed", "failed"].includes(job.status)
                ? job.status
                : "processing",
            },
            $addToSet: { jobs: job._id },
          },
        );

        // If not pending (or not found), still ensure job is recorded.
        if (!r1 || r1.matchedCount === 0) {
          await Decision.updateOne(
            { _id: decisionId },
            { $addToSet: { jobs: job._id } },
          );
        }
      } else {
        // Fallback for older callers: query by classroomId/challengeId/userId
        const decision = await Decision.findOne({
          classroomId: input.classroomId,
          challengeId: input.challengeId,
          userId: input.userId,
        });
        if (decision) {
          await decision.addJob(job._id);
        }
      }
    } catch (err) {
      console.error("Failed to link job to decision:", err);
      // Don't throw - job creation should still succeed even if linking fails
    }

    if (enqueue && !input.dryRun) {
      await require("./challengeProcessing").enqueuePending(input.challengeId);
    }

    return job;
  }

  /**
   * Create jobs for all decisions in a challenge
   * @param {string} challengeId - Challenge ID
   * @param {string} classroomId - Class ID
   * @param {boolean} dryRun - Whether this is a dry run (preview)
   * @param {string} organizationId - Organization ID
   * @param {string} clerkUserId - Clerk user ID
   * @returns {Promise<Array>} Array of created jobs
   */
  static async createJobsForScenario(
    challengeId,
    classroomId,
    dryRun = false,
    organizationId,
    clerkUserId,
    options = {},
  ) {
    const Decision = require("../../decision/decision.model");

    // Get lightweight decision refs for this challenge (avoid expensive populates/variable population)
    const decisions = await Decision.getSubmissionRefsByScenario(challengeId);

    if (decisions.length === 0) {
      return [];
    }

    // Create jobs for each decision (createJob will link them automatically).
    // Process synchronously to keep behavior simple and predictable.
    const enqueue = options.enqueue !== undefined ? options.enqueue : true;

    const jobs = [];
    for (const decision of decisions) {
      const job = await this.createJob({
        classroomId,
        challengeId,
        userId: decision.userId,
        dryRun,
        decisionId: decision._id,
        organizationId,
        clerkUserId,
        enqueue: false,
        processingRunId: options.processingRunId,
        simulationMode: options.simulationMode,
        simulationConcurrency: options.simulationConcurrency,
        preserveExisting: options.preserveExisting,
      });
      jobs.push(job);
    }

    if (enqueue && !dryRun)
      await require("./challengeProcessing").enqueuePending(challengeId);
    return jobs;
  }

  /**
   * Get jobs for a challenge
   * @param {string} challengeId - Challenge ID
   * @returns {Promise<Array>} Array of jobs
   */
  static async getJobsByScenario(challengeId) {
    return await SimulationJob.getJobsByScenario(challengeId);
  }

  /**
   * Get pending jobs (for worker processing)
   * @param {number} limit - Maximum number of jobs to return
   * @returns {Promise<Array>} Array of pending jobs
   */
  static async getPendingJobs(limit = 10) {
    return await SimulationJob.getPendingJobs(limit);
  }

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Promise<Object|null>} Job or null
   */
  static async getJobById(jobId) {
    return await SimulationJob.getJobById(jobId);
  }

  /**
   * Enqueue pending jobs that weren't enqueued to Bull
   * Useful for recovering jobs that were created but not enqueued
   * @param {string} [challengeId] - Optional challenge ID to filter by
   * @returns {Promise<Object>} Result with enqueued count
   */
  static async enqueuePendingJobs(challengeId = null) {
    const ids = challengeId
      ? [challengeId]
      : await SimulationJob.distinct("challengeId", {
          status: "pending",
          dryRun: false,
        });
    for (const id of ids)
      await require("./challengeProcessing").enqueuePending(id);
    return { total: ids.length, enqueued: ids.length, failed: 0 };
  }

  /**
   * Reset all jobs for a challenge (used during reruns)
   * @param {string} challengeId - Challenge ID
   * @returns {Promise<Object>} Update result
   */
  static async resetJobsForScenario(challengeId) {
    return await SimulationJob.updateMany(
      { challengeId },
      {
        $set: {
          status: "pending",
          attempts: 0,
          error: null,
          startedAt: null,
          completedAt: null,
          ledgerCompletionTracking: true,
          ledgerCompletionReconciledAt: null,
        },
      },
    );
  }

  /**
   * Cancel Mongo-backed jobs and remove any non-active Bull jobs for a challenge.
   * Active workers observe the cancelled state before persisting results.
   */
  static async cancelJobsForScenario(challengeId, organizationId = null) {
    const query = { challengeId };
    if (organizationId) query.organization = organizationId;
    const jobs = await SimulationJob.find(query).select(
      "_id status processingRunId",
    );
    const jobIds = jobs.map((job) => String(job._id));

    await SimulationJob.updateMany(
      {
        ...query,
        status: { $in: ["pending", "running", "failed", "completed"] },
      },
      {
        $set: {
          status: "cancelled",
          completedAt: new Date(),
          error: "Cancelled by instructor while reopening challenge",
          dispatchReserved: false,
          ledgerCompletionTracking: false,
          ledgerCompletionReconciledAt: null,
        },
      }
    );

    await ensureQueueReady(queues.simulation, "simulation");
    let removed = 0;
    let active = 0;
    for (const job of jobs) {
      const queueIds = [
        `simulation:${job._id}:${job.processingRunId || "legacy"}`,
        `simulation:${job._id}`,
      ];
      for (const queueId of queueIds) {
        const queuedJob = await queues.simulation.getJob(queueId);
        if (!queuedJob) continue;
        const state = await queuedJob.getState();
        if (state === "active") {
          active += 1;
          await queuedJob.discard();
          continue;
        }
        await queuedJob.remove();
        removed += 1;
      }
    }

    return { total: jobIds.length, removed, active };
  }

  /**
   * Invalidate terminal calculation records without touching Bull queues.
   * Used when a finished challenge's results are discarded and reopened.
   */
  static async invalidateJobsForScenario(challengeId, organizationId = null) {
    const query = { challengeId };
    if (organizationId) query.organization = organizationId;
    const result = await SimulationJob.updateMany(
      query,
      {
        $set: {
          status: "cancelled",
          completedAt: new Date(),
          error: "Results invalidated by instructor while reopening challenge",
          dispatchReserved: false,
          ledgerCompletionTracking: false,
          ledgerCompletionReconciledAt: null,
          ledgerEntryId: null,
        },
      }
    );
    return { total: result.modifiedCount || 0, removed: 0, active: 0 };
  }
}

module.exports = JobService;
