const cron = require("node-cron");
const ServiceRunner = require("./ServiceRunner");
const ServiceWorkerRegistry = require("./ServiceWorkerRegistry");
const CronJob = require("../cron/cron.model");

/**
 * Stop all scheduled jobs
 */
function stopAllScheduledJobs(scheduledJobs) {
  console.log(`🛑 Stopping ${scheduledJobs.size} running cron jobs...`);
  for (const [jobName, job] of scheduledJobs.entries()) {
    console.log(`  ⏹️  Stopping job: ${jobName}`);
    job.stop();
  }
  scheduledJobs.clear();
  console.log("✅ All jobs stopped");
}

/**
 * Create a job function for a cron job
 */
function createJobFunction(cronJob) {
  const workerConfig = ServiceWorkerRegistry.getWorker(cronJob.workerType);
  if (!workerConfig) {
    console.warn(`⚠️  Worker type ${cronJob.workerType} not found in registry`);
    return null;
  }

  return async () => {
    try {
      console.log(
        `\n🎯 Executing cron job: ${cronJob.jobName || cronJob.workerType}`
      );
      console.log(`⏰ Started at: ${new Date().toISOString()}`);

      const result = await ServiceRunner.runWorkerFromCronJob(cronJob);

      if (result.success) {
        console.log(`✅ Job completed successfully`);
      } else {
        console.error(`❌ Job failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`💥 Job execution failed:`, error.message);
    }
  };
}

/**
 * Schedule jobs from database
 */
async function scheduleJobsFromDB(scheduledJobs) {
  try {
    console.log("\n🔄 Fetching enabled cron jobs from database...");

    const dbCronJobs = await CronJob.find({
      enabled: true,
    }).populate("organization");

    console.log(`📊 Found ${dbCronJobs.length} enabled jobs in database`);

    stopAllScheduledJobs(scheduledJobs);

    let scheduledCount = 0;
    for (const cronJob of dbCronJobs) {
      try {
        const jobFunction = createJobFunction(cronJob);

        if (jobFunction) {
          const jobKey = cronJob.organization
            ? `${cronJob.jobName || cronJob.workerType}_${
                cronJob.organization._id
              }`
            : cronJob.jobName || cronJob.workerType;

          const job = cron.schedule(cronJob.schedule, jobFunction, {
            scheduled: true,
            timezone: cronJob.timezone || "America/Chicago",
          });

          scheduledJobs.set(jobKey, job);
          scheduledCount++;

          const jobDisplayName =
            cronJob.jobName || `${cronJob.workerType} worker`;
          const orgInfo = cronJob.organization
            ? ` for organization: ${cronJob.organization.name}`
            : " (system-wide)";

          console.log(
            `✅ Scheduled: ${jobDisplayName} (${cronJob.schedule})${orgInfo}`
          );
        } else {
          const jobDisplayName = cronJob.jobName || cronJob.workerType;
          console.warn(
            `⚠️  Failed to schedule: ${jobDisplayName} - job function could not be created`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error scheduling job ${cronJob.jobName}:`,
          error.message
        );
      }
    }

    console.log(
      `🎉 Finished scheduling ${scheduledCount}/${dbCronJobs.length} jobs\n`
    );
  } catch (error) {
    console.error(
      "💥 Error fetching/scheduling jobs from database:",
      error.message
    );
  }
}

/**
 * Ensure default system jobs are up to date
 */
async function ensureDefaultJobs() {
  try {
    console.log("🔧 Ensuring default system jobs are up to date...");
    const systemWorkers = ServiceWorkerRegistry.getSystemWorkers();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const worker of systemWorkers) {
      try {
        const existingJob = await CronJob.findOne({
          workerType: worker.workerType,
          isSystemJob: true,
        });

        if (existingJob) {
          const updates = {
            jobName: worker.name,
            description: worker.description,
            schedule: worker.defaultSchedule,
            timezone: worker.timezone,
            organization: null,
            updatedBy: "system",
            updatedDate: new Date(),
          };

          const needsUpdate =
            existingJob.jobName !== worker.name ||
            existingJob.description !== worker.description ||
            existingJob.schedule !== worker.defaultSchedule ||
            existingJob.timezone !== worker.timezone;

          if (needsUpdate) {
            await CronJob.findByIdAndUpdate(existingJob._id, updates);
            console.log(`🔄 Updated job: ${worker.name}`);
            updated++;
          } else {
            console.log(`✓ Job up to date: ${worker.name}`);
            skipped++;
          }
        } else {
          const defaultJob = new CronJob({
            jobName: worker.name,
            description: worker.description,
            workerType: worker.workerType,
            schedule: worker.defaultSchedule,
            timezone: worker.timezone,
            enabled: worker.enabled,
            isSystemJob: true,
            organization: null,
            createdBy: "system",
            updatedBy: "system",
            createdDate: new Date(),
            updatedDate: new Date(),
          });

          await defaultJob.save();
          console.log(
            `➕ Created job: ${worker.name} (${worker.defaultSchedule})`
          );
          created++;
        }
      } catch (workerError) {
        console.error(
          `❌ Error processing worker ${worker.workerType}:`,
          workerError.message
        );
        skipped++;
      }
    }

    console.log(
      `✅ Job sync completed: ${created} created, ${updated} updated, ${skipped} unchanged`
    );
  } catch (error) {
    console.error("❌ Error ensuring default jobs:", error.message);
  }
}

/**
 * Print system status
 */
function printSystemStatus(scheduledJobs) {
  console.log("\n📊 WORKERS SERVICE STATUS");
  console.log("=========================");
  console.log(`⏰ Current time: ${new Date().toISOString()}`);
  const instanceId =
    process.env.INSTANCE_ID ||
    `${process.env.HOSTNAME || "host"}-${process.pid}`;
  console.log(`🆔 Instance: ${instanceId}`);
  console.log(`🌍 Timezone: ${require("moment-timezone").tz.guess()}`);
  console.log(`🌐 Service port: ${process.env.PORT_WORKERS || 1341}`);
  console.log(
    `📡 MongoDB: ${
      require("mongoose").connection.readyState === 1
        ? "connected"
        : "disconnected"
    }`
  );

  console.log(`📅 Scheduled jobs: ${scheduledJobs.size}`);

  ServiceWorkerRegistry.printStatus();
  ServiceRunner.printStatus();

  if (scheduledJobs.size > 0) {
    console.log("📋 SCHEDULED JOBS:");
    for (const [jobKey] of scheduledJobs.entries()) {
      console.log(`  • ${jobKey}`);
    }
  }
  console.log("");
}

/**
 * Setup job refresh schedule
 */
function setupJobRefreshSchedule(scheduledJobs) {
  console.log("🔄 Setting up job refresh schedule...");

  // Refresh jobs at midnight
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("----------------------------------------");
      console.log(
        `🔄 Checking for cron job updates at ${new Date().toISOString()}`
      );
      await scheduleJobsFromDB(scheduledJobs);
      console.log("----------------------------------------");
    },
    { timezone: "America/Chicago" }
  );

  // Print status every hour
  cron.schedule(
    "0 * * * *",
    () => {
      printSystemStatus(scheduledJobs);
    },
    { timezone: "America/Chicago" }
  );
}

/**
 * Initialize queue workers
 */
function initializeQueueWorkers() {
  try {
    // PDF generation disabled for now
    // const { initPdfWorker } = require("../../lib/queues/pdf-worker");
    const { initEmailWorker } = require("../../lib/queues/email-worker");
    // SMS worker disabled - not sending SMS messages
    // const { initSmsWorker } = require("../../lib/queues/sms-worker");
    // Push notifications disabled - not using push notifications
    // const { initPushWorker } = require("../../lib/queues/push-worker");

    // initPdfWorker();
    initEmailWorker();
    // initSmsWorker();
    // initPushWorker();

    console.log("✅ Queue workers initialized");
  } catch (error) {
    console.error("❌ Failed to initialize queue workers:", error);
    // Don't exit the process if queue initialization fails
  }
}

/**
 * Setup graceful shutdown handling
 */
function setupGracefulShutdown(server, scheduledJobs) {
  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    let shutdownTimeout;
    const forceExit = () => {
      console.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    };

    try {
      // Stop all active jobs
      stopAllScheduledJobs(scheduledJobs);
      const stoppedCount = ServiceRunner.stopAllJobs();
      console.log(`🛑 Stopped ${stoppedCount} active jobs`);

      // Close queues
      const { closeQueues } = require("../../lib/queues");
      await closeQueues(5000);

      // Close HTTP server
      await new Promise((resolve, reject) => {
        shutdownTimeout = setTimeout(() => {
          reject(new Error("Server close timeout"));
        }, 8000);

        server.close((err) => {
          clearTimeout(shutdownTimeout);
          if (err) {
            reject(err);
          } else {
            console.log("✅ HTTP server closed");
            resolve();
          }
        });
      });

      // Close MongoDB connection
      await require("mongoose").connection.close();
      console.log("✅ MongoDB connection closed");

      console.log("✅ Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error.message);
      clearTimeout(shutdownTimeout);
      forceExit();
    }
  };

  // Handle different shutdown signals
  let isShuttingDown = false;
  const shutdownHandler = (signal) => {
    if (isShuttingDown) {
      console.log("Shutdown already in progress, forcing exit...");
      process.exit(1);
    }
    isShuttingDown = true;
    gracefulShutdown(signal).catch(() => {
      process.exit(1);
    });
  };

  process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
  process.on("SIGINT", () => shutdownHandler("SIGINT"));
  process.on("SIGUSR2", () => shutdownHandler("SIGUSR2")); // nodemon restart signal

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("💥 Uncaught Exception:", error);
    shutdownHandler("UNCAUGHT_EXCEPTION");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
    shutdownHandler("UNHANDLED_REJECTION");
  });
}

module.exports = {
  stopAllScheduledJobs,
  createJobFunction,
  scheduleJobsFromDB,
  ensureDefaultJobs,
  printSystemStatus,
  setupJobRefreshSchedule,
  initializeQueueWorkers,
  setupGracefulShutdown,
};
