const express = require("express");
const workersController = require("./workers.controller");

const router = express.Router();

// Health check endpoint (no auth required)
router.get("/", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "kikits-workers-service",
    timestamp: new Date().toISOString(),
  });
});

// Status endpoint (no auth required)
router.get("/status", workersController.getStatus);

// Registry endpoint (no auth required)
router.get("/registry", workersController.getRegistry);

// Manual worker execution endpoint (for testing/debugging)
router.post("/run/:workerType", workersController.runWorker);

// Stop all active jobs endpoint (emergency stop)
router.post("/stop-all", workersController.stopAllJobs);

// Refresh scheduled jobs from database
router.post("/refresh-jobs", workersController.refreshJobs);

// Stop all scheduled jobs
router.post("/stop-scheduled", workersController.stopScheduledJobs);

// Health check endpoints
router.get("/status/redis", workersController.redisHealth);
router.get("/status/queues", workersController.queueStats);
router.get("/status/mongodb", workersController.mongodbHealth);

module.exports = router;
