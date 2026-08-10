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
      clerkUserId
    );

    // Link job to decision if decision exists
    try {
      const Decision = require("../../decision/decision.model");
      if (decisionId) {
        // Avoid fetching the decision: link job via atomic update.
        const r1 = await Decision.updateOne(
          { _id: decisionId, processingStatus: "pending" },
          {
            $set: { processingStatus: "processing" },
            $addToSet: { jobs: job._id },
          }
        );

        // If not pending (or not found), still ensure job is recorded.
        if (!r1 || r1.matchedCount === 0) {
          await Decision.updateOne(
            { _id: decisionId },
            { $addToSet: { jobs: job._id } }
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

    if (enqueue) {
      // Enqueue for Bull processing (one-at-a-time processor handles ordering)
      // Always enqueue, even if job already existed (it may have been reset)
      try {
        await ensureQueueReady(queues.simulation, "simulation");
        await queues.simulation.add(
          { jobId: job._id },
          {
            // Deduplicate Bull jobs per SimulationJob to avoid accidental queue storms
            // (e.g., challenge outcome processing retries, admin double-submits, etc.).
            jobId: `simulation:${String(job._id)}`,
            attempts: 3,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: true,
            removeOnFail: false,
          }
        );
      } catch (err) {
        console.error("Failed to enqueue simulation job:", err.message);
        // Surface the error so the caller knows the job was not enqueued
        throw err;
      }
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
    options = {}
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
        enqueue,
      });
      jobs.push(job);
    }

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
    const { queues, ensureQueueReady } = require("../../../lib/queues");
    const {
      enqueueSimulationJob,
    } = require("../../../lib/queues/simulation-worker");

    const query = { status: "pending" };
    if (challengeId) {
      query.challengeId = challengeId;
    }

    const pendingJobs = await SimulationJob.find(query);
    let enqueued = 0;
    let failed = 0;
    const errors = [];

    for (const job of pendingJobs) {
      try {
        await ensureQueueReady(queues.simulation, "simulation");
        await enqueueSimulationJob(job._id);
        enqueued++;
      } catch (err) {
        console.error(`Failed to enqueue pending job ${job._id}:`, err.message);
        failed++;
        errors.push({ jobId: job._id, error: err.message });
      }
    }

    return {
      total: pendingJobs.length,
      enqueued,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
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
      }
    );
  }
}

module.exports = JobService;
