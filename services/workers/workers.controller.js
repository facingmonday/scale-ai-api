const ServiceRunner = require("./ServiceRunner");
const ServiceWorkerRegistry = require("./ServiceWorkerRegistry");
const { getQueueStats } = require("../../lib/queues");
const HealthChecker = require("../../lib/health-checks");
const mongoose = require("mongoose");

// Initialize health checker for workers service
const healthChecker = new HealthChecker("workers");

/**
 * Status endpoint with detailed information
 */
exports.getStatus = async (req, res) => {
  const activeJobs = ServiceRunner.getActiveJobs();
  const allWorkers = ServiceWorkerRegistry.getAllWorkers();
  const systemWorkers = ServiceWorkerRegistry.getSystemWorkers();
  const orgWorkers = ServiceWorkerRegistry.getOrganizationWorkers();
  const scheduledJobs = req.app.locals.scheduledJobs || new Map();
  const jobList = Array.from(scheduledJobs.keys());

  // Get queue stats
  let queueStats = {};
  try {
    queueStats = await getQueueStats();
  } catch (error) {
    console.error("Error getting queue stats:", error);
    queueStats = { error: error.message };
  }

  res.json({
    status: "healthy",
    service: "scale-ai-workers-service",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    mongodb: {
      status:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      readyState: mongoose.connection.readyState,
      host: process.env.MONGO_HOSTNAME,
    },
    workers: {
      total: allWorkers.size,
      system: systemWorkers.length,
      organization: orgWorkers.length,
      active: activeJobs.length,
      registry: Array.from(allWorkers.entries()).map(([type, config]) => ({
        type,
        name: config.name,
        enabled: config.enabled,
        isSystemWorker: config.isSystemWorker,
        requiresOrganization: config.requiresOrganization,
        defaultSchedule: config.defaultSchedule,
        timezone: config.timezone,
      })),
    },
    queues: queueStats,
    scheduler: {
      enabled: process.env.WORKERS_ENABLED === "true",
      scheduled: scheduledJobs.size,
      scheduledList: jobList,
    },
    activeJobs: activeJobs.map((job) => ({
      key: job.jobKey,
      type: job.workerType,
      organizationId: job.organizationId,
      startTime: job.startTime,
      duration: Math.round(job.duration / 1000) + "s",
    })),
  });
};

/**
 * Manual worker execution endpoint (for testing/debugging)
 */
exports.runWorker = async (req, res) => {
  try {
    const { workerType } = req.params;
    const { organizationId } = req.body;

    console.log(`🎯 Manual execution requested for worker: ${workerType}`);
    if (organizationId) {
      console.log(`   Organization ID: ${organizationId}`);
    }

    const result = await ServiceRunner.runWorker(workerType, organizationId);

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ Manual worker execution failed:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Stop all active jobs endpoint (emergency stop)
 */
exports.stopAllJobs = (req, res) => {
  try {
    const stoppedCount = ServiceRunner.stopAllJobs();

    res.json({
      success: true,
      message: `Stopped ${stoppedCount} active jobs`,
      stoppedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ Stop all jobs failed:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get worker registry information
 */
exports.getRegistry = (req, res) => {
  const allWorkers = ServiceWorkerRegistry.getAllWorkers();
  const systemWorkers = ServiceWorkerRegistry.getSystemWorkers();
  const orgWorkers = ServiceWorkerRegistry.getOrganizationWorkers();

  res.json({
    success: true,
    registry: {
      total: allWorkers.size,
      system: systemWorkers,
      organization: orgWorkers,
      all: Array.from(allWorkers.entries()).map(([type, config]) => ({
        type,
        ...config,
      })),
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Refresh scheduled jobs from database
 */
exports.refreshJobs = async (req, res) => {
  try {
    const { scheduleJobsFromDB } = require("./workers.helpers");
    await scheduleJobsFromDB(req.app.locals.scheduledJobs);

    res.json({
      success: true,
      message: "Jobs refreshed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ Refresh jobs failed:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Stop all scheduled jobs
 */
exports.stopScheduledJobs = (req, res) => {
  try {
    const { stopAllScheduledJobs } = require("./workers.helpers");
    stopAllScheduledJobs(req.app.locals.scheduledJobs);

    res.json({
      success: true,
      message: "All scheduled jobs stopped",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ Stop scheduled jobs failed:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Redis health check endpoint
 */
exports.redisHealth = async (req, res) => {
  try {
    const redisStatus = await healthChecker.checkRedis();
    const statusCode = redisStatus.status === "healthy" ? 200 : 503;
    res.status(statusCode).json({
      service: "workers",
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      service: "workers",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Queue statistics endpoint
 */
exports.queueStats = async (req, res) => {
  try {
    const queueStats = await healthChecker.getQueueStats();
    const statusCode = queueStats.status === "healthy" ? 200 : 503;
    res.status(statusCode).json({
      service: "workers",
      queues: queueStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      service: "workers",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * MongoDB health check endpoint
 */
exports.mongodbHealth = async (req, res) => {
  try {
    const mongoStatus = await healthChecker.checkMongoDB();
    const statusCode = mongoStatus.status === "healthy" ? 200 : 503;
    res.status(statusCode).json({
      service: "workers",
      mongodb: mongoStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      service: "workers",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
