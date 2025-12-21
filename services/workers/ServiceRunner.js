/**
 * Service Runner
 *
 * This service handles the execution of registered workers.
 * It provides a unified interface for running workers with proper
 * error handling, logging, and timeout management.
 */

const ServiceWorkerRegistry = require("./ServiceWorkerRegistry");
const CronJob = require("../../services/cron/cron.model");

// MongoDB connection configuration
const {
  MONGO_SCHEME,
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_HOSTNAME,
  MONGO_DB,
} = process.env;

const mongoUrl = `${MONGO_SCHEME}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DB}?authSource=admin`;

class ServiceRunner {
  constructor() {
    this.activeJobs = new Map(); // Track currently running jobs
  }

  /**
   * Run a worker by type
   * @param {string} workerType - Type of worker to run
   * @param {string} organizationId - Organization ID (optional for system workers)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Execution result
   */
  async runWorker(workerType, organizationId = null, options = {}) {
    const startTime = Date.now();
    const jobKey = organizationId
      ? `${workerType}_${organizationId}`
      : workerType;

    try {
      console.log(
        `🚀 Starting worker: ${workerType}${
          organizationId ? ` for org: ${organizationId}` : ""
        }`
      );

      // Get worker configuration
      const workerConfig = ServiceWorkerRegistry.getWorker(workerType);
      if (!workerConfig) {
        throw new Error(`Worker type ${workerType} not found in registry`);
      }

      // Check if worker is already running
      if (this.activeJobs.has(jobKey)) {
        console.log(
          `⚠️  Worker ${jobKey} is already running, skipping execution`
        );
        return {
          success: false,
          error: "Worker already running",
          skipped: true,
          duration: 0,
        };
      }

      // Mark job as active
      this.activeJobs.set(jobKey, { startTime, workerType, organizationId });

      // Validate organization requirement
      if (workerConfig.requiresOrganization && !organizationId) {
        throw new Error(`Worker ${workerType} requires an organization ID`);
      }

      // Execute the worker
      const result = await this.executeWorker(
        workerType,
        organizationId,
        options
      );

      const duration = Date.now() - startTime;
      console.log(
        `✅ Worker ${workerType} completed successfully in ${duration}ms`
      );

      return {
        success: true,
        error: null,
        duration,
        result,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Worker ${workerType} failed:`, error.message);

      return {
        success: false,
        error: error.message,
        duration,
        result: null,
      };
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(jobKey);
    }
  }

  /**
   * Execute a worker based on its type
   * @param {string} workerType - Worker type (e.g., "ticket-reminder", "daily-stats")
   * @param {string} organizationId - Organization ID (optional)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Worker execution result
   */
  async executeWorker(workerType, organizationId = null, options = {}) {
    // Ensure database connection
    await this.ensureDatabaseConnection();

    // Execute worker based on type
    throw new Error(`Unknown worker type: ${workerType}`);
  }

  /**
   * Ensure database connection is established
   */
  async ensureDatabaseConnection() {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUrl);
    }
  }

  /**
   * Run a worker from a database cron job configuration
   * @param {Object} cronJob - CronJob document from database
   * @returns {Promise<Object>} Execution result
   */
  async runWorkerFromCronJob(cronJob) {
    let result;
    const startTime = Date.now();
    const instanceId =
      process.env.INSTANCE_ID ||
      `${process.env.HOSTNAME || "host"}-${process.pid}`;

    try {
      // Acquire per-job lease to prevent duplicate executions across instances
      const leaseTtlMs = 15 * 60 * 1000; // 15 minutes safety window
      const acquired = await cronJob.tryAcquireLease(instanceId, leaseTtlMs);
      if (!acquired) {
        console.log(
          `⚠️  Lease not acquired for job ${cronJob.jobName} by ${instanceId}, skipping`
        );
        return {
          success: false,
          error: "Lease not acquired",
          skipped: true,
          duration: 0,
        };
      }

      // Mark job as started
      await cronJob.markStarted();

      // Extract organization ID
      const organizationId = cronJob.organization?.toString() || null;

      // Run the worker
      result = await this.runWorker(cronJob.workerType, organizationId);

      // Mark job as completed
      await cronJob.markCompleted(result.success, result.error);

      const duration = Date.now() - startTime;
      console.log(
        `📊 CronJob ${cronJob.jobName} completed in ${duration}ms (Success: ${result.success})`
      );

      return result;
    } catch (error) {
      // Mark job as failed
      await cronJob.markCompleted(false, error.message);

      console.error(`💥 CronJob ${cronJob.jobName} failed:`, error.message);
      throw error;
    } finally {
      // Release lease if held by this instance
      try {
        await cronJob.releaseLease(instanceId);
      } catch (releaseErr) {
        console.error("⚠️  Failed to release lease:", releaseErr.message);
      }
    }
  }

  /**
   * Get currently active jobs
   * @returns {Array} Array of active job information
   */
  getActiveJobs() {
    const activeJobs = [];
    for (const [jobKey, jobInfo] of this.activeJobs.entries()) {
      activeJobs.push({
        jobKey,
        workerType: jobInfo.workerType,
        organizationId: jobInfo.organizationId,
        startTime: jobInfo.startTime,
        duration: Date.now() - jobInfo.startTime,
      });
    }
    return activeJobs;
  }

  /**
   * Kill all active jobs (emergency stop)
   * @returns {number} Number of jobs that were stopped
   */
  stopAllJobs() {
    const count = this.activeJobs.size;
    console.log(`🛑 Stopping ${count} active jobs...`);

    // Clear the active jobs map
    this.activeJobs.clear();

    console.log(`✅ Stopped ${count} jobs`);
    return count;
  }

  /**
   * Print runner status for debugging
   */
  printStatus() {
    const activeJobs = this.getActiveJobs();

    console.log("\n⚙️  SERVICE RUNNER STATUS");
    console.log("========================");
    console.log(`Active jobs: ${activeJobs.length}`);

    if (activeJobs.length > 0) {
      console.log("\n🏃 ACTIVE JOBS:");
      activeJobs.forEach((job) => {
        const duration = Math.round(job.duration / 1000);
        console.log(`  • ${job.jobKey} (${duration}s running)`);
      });
    } else {
      console.log("No jobs currently running");
    }
    console.log("");
  }
}

// Create and export singleton instance
const serviceRunner = new ServiceRunner();

module.exports = serviceRunner;
