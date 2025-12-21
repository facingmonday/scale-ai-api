const SimulationJob = require("../job.model");
const { queues, ensureQueueReady } = require("../../../lib/queues");

/**
 * Job Service
 * Handles job creation and management
 */
class JobService {
  /**
   * Create a simulation job
   * @param {Object} input - Job data (classroomId, scenarioId, userId, dryRun)
   * @param {string} organizationId - Organization ID
   * @param {string} clerkUserId - Clerk user ID
   * @returns {Promise<Object>} Created job
   */
  static async createJob(input, organizationId, clerkUserId) {
    const job = await SimulationJob.createJob(input, organizationId, clerkUserId);

    // Enqueue for Bull processing (one-at-a-time processor handles ordering)
    try {
      await ensureQueueReady(queues.simulation, "simulation");
      await queues.simulation.add(
        { jobId: job._id },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    } catch (err) {
      console.error("Failed to enqueue simulation job:", err);
      // Surface the error so the caller knows the job was not enqueued
      throw err;
    }

    return job;
  }

  /**
   * Create jobs for all submissions in a scenario
   * @param {string} scenarioId - Scenario ID
   * @param {string} classroomId - Class ID
   * @param {boolean} dryRun - Whether this is a dry run (preview)
   * @param {string} organizationId - Organization ID
   * @param {string} clerkUserId - Clerk user ID
   * @returns {Promise<Array>} Array of created jobs
   */
  static async createJobsForScenario(
    scenarioId,
    classroomId,
    dryRun = false,
    organizationId,
    clerkUserId
  ) {
    const Submission = require("../../submission/submission.model");

    // Get all submissions for this scenario
    const submissions = await Submission.getSubmissionsByScenario(scenarioId);

    if (submissions.length === 0) {
      return [];
    }

    // Create jobs for each submission
    const jobPromises = submissions.map((submission) =>
      this.createJob(
        {
          classroomId,
          scenarioId,
          userId: submission.member?._id,
          dryRun,
        },
        organizationId,
        clerkUserId
      )
    );

    const jobs = await Promise.all(jobPromises);
    return jobs;
  }

  /**
   * Get jobs for a scenario
   * @param {string} scenarioId - Scenario ID
   * @returns {Promise<Array>} Array of jobs
   */
  static async getJobsByScenario(scenarioId) {
    return await SimulationJob.getJobsByScenario(scenarioId);
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
   * Reset all jobs for a scenario (used during reruns)
   * @param {string} scenarioId - Scenario ID
   * @returns {Promise<Object>} Update result
   */
  static async resetJobsForScenario(scenarioId) {
    return await SimulationJob.updateMany(
      { scenarioId },
      {
        $set: {
          status: "pending",
          attempts: 0,
          error: null,
          startedAt: null,
          completedAt: null,
        },
      }
    );
  }
}

module.exports = JobService;
