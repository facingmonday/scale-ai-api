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
   * @param {string} params.scenarioId
   * @param {string} params.userId
   * @param {boolean} [params.dryRun]
   * @param {string|null} [params.submissionId] - Optional submission ID to link job to
   * @param {string} params.organizationId
   * @param {string} params.clerkUserId
   * @returns {Promise<Object>} Created job
   */
  static async createJob(params) {
    const {
      organizationId,
      clerkUserId,
      submissionId = null,
      ...input
    } = params;

    const job = await SimulationJob.createJob(
      {
        ...input,
        submissionId,
      },
      organizationId,
      clerkUserId
    );

    // Link job to submission if submission exists
    try {
      const Submission = require("../../submission/submission.model");
      if (submissionId) {
        // Avoid fetching the submission: link job via atomic update.
        const r1 = await Submission.updateOne(
          { _id: submissionId, processingStatus: "pending" },
          {
            $set: { processingStatus: "processing" },
            $addToSet: { jobs: job._id },
          }
        );

        // If not pending (or not found), still ensure job is recorded.
        if (!r1 || r1.matchedCount === 0) {
          await Submission.updateOne(
            { _id: submissionId },
            { $addToSet: { jobs: job._id } }
          );
        }
      } else {
        // Fallback for older callers: query by classroomId/scenarioId/userId
        const submission = await Submission.findOne({
          classroomId: input.classroomId,
          scenarioId: input.scenarioId,
          userId: input.userId,
        });
        if (submission) {
          await submission.addJob(job._id);
        }
      }
    } catch (err) {
      console.error("Failed to link job to submission:", err);
      // Don't throw - job creation should still succeed even if linking fails
    }

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

    // Create jobs for each submission (createJob will link them automatically)
    const jobPromises = submissions.map(async (submission) => {
      // Get userId from submission (could be in member._id or userId field)
      // submission.userId from toObject() will be the ObjectId
      const userId = submission.member?._id || submission.userId;

      const job = await this.createJob({
        classroomId,
        scenarioId,
        userId,
        dryRun,
        submissionId: submission._id,
        organizationId,
        clerkUserId,
      });

      return job;
    });

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
