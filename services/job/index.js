/**
 * Job Service Routes
 * 
 * Provides endpoints for managing background jobs (simulation processing, etc.).
 * All routes require org:admin role.
 * Mounted at: /v1/admin/job
 */
const express = require("express");
const controller = require("./job.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
} = require("../../middleware/auth");

// All routes require org:admin role
router.use(requireAuth(), checkRole("org:admin"));

// Get jobs for a scenario
router.get("/scenario/:scenarioId", controller.getJobsByScenario);

// Get job by ID
router.get("/:jobId", controller.getJobById);

// Retry a failed job
router.post("/:jobId/retry", controller.retryJob);

// Process pending jobs (manual trigger)
router.post("/process-pending", controller.processPendingJobs);

module.exports = router;

