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

// Get jobs for a challenge
/**
 * @openapi
 * /v1/admin/job/challenge/{challengeId}:
 *   get:
 *     summary: Get jobs for a challenge
 *     description: Fetch background calculation/simulation jobs associated with a scenario challenge. Requires org:admin role.
 *     tags:
 *       - Jobs
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: challengeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of jobs.
 */
router.get("/challenge/:challengeId", controller.getJobsByScenario);

// Get job by ID
/**
 * @openapi
 * /v1/admin/job/{jobId}:
 *   get:
 *     summary: Get job status by ID
 *     description: Fetch status and metadata for a specific background job by ID. Requires org:admin role.
 *     tags:
 *       - Jobs
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: jobId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job details and status.
 */
router.get("/:jobId", controller.getJobById);

// Retry a failed job
/**
 * @openapi
 * /v1/admin/job/{jobId}/retry:
 *   post:
 *     summary: Retry a failed job
 *     description: Retries execution of a failed simulation or processing job. Requires org:admin role.
 *     tags:
 *       - Jobs
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: jobId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job retry triggered.
 */
router.post("/:jobId/retry", controller.retryJob);

// Process pending jobs (manual trigger)
/**
 * @openapi
 * /v1/admin/job/process-pending:
 *   post:
 *     summary: Process pending jobs
 *     description: Manually trigger processing for all pending background jobs. Requires org:admin role.
 *     tags:
 *       - Jobs
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Manual trigger initiated.
 */
router.post("/process-pending", controller.processPendingJobs);

module.exports = router;

