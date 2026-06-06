/**
 * MetricDefinition Service Routes
 *
 * Provides endpoints for managing dynamic metric definitions (simulation outputs).
 * Metrics define what the AI computes and what the UI displays as KPIs, charts,
 * tables, and leaderboards.
 *
 * Mounted at: /v1/admin/metrics
 */
const express = require("express");
const controller = require("./metricDefinition.controller");
const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

/**
 * @openapi
 * /v1/admin/metrics:
 *   post:
 *     summary: Create metric definition
 *     description: Define a new system output metric. Requires org:admin role.
 *     tags:
 *       - Metric Definitions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully.
 */
router.post(
  "/admin/metrics",
  requireAuth(),
  checkRole("org:admin"),
  controller.createMetricDefinition
);

/**
 * @openapi
 * /v1/admin/metrics/{key}:
 *   put:
 *     summary: Update metric definition
 *     description: Modify metric definition details by key. Requires org:admin role.
 *     tags:
 *       - Metric Definitions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated successfully.
 */
router.put(
  "/admin/metrics/:key",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateMetricDefinition
);

/**
 * @openapi
 * /v1/admin/metrics:
 *   get:
 *     summary: Get all metric definitions
 *     description: Retrieve all metric definitions defined for the organization.
 *     tags:
 *       - Metric Definitions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of metric definitions.
 */
router.get(
  "/admin/metrics",
  requireAuth(),
  controller.getMetricDefinitions
);

/**
 * @openapi
 * /v1/admin/metrics/{key}:
 *   delete:
 *     summary: Delete metric definition
 *     description: Delete a metric definition record by key. Requires org:admin role.
 *     tags:
 *       - Metric Definitions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted successfully.
 */
router.delete(
  "/admin/metrics/:key",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteMetricDefinition
);

module.exports = router;
