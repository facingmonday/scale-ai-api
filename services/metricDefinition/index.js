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

router.post(
  "/admin/metrics",
  requireAuth(),
  checkRole("org:admin"),
  controller.createMetricDefinition
);

router.put(
  "/admin/metrics/:key",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateMetricDefinition
);

router.get(
  "/admin/metrics",
  requireAuth(),
  controller.getMetricDefinitions
);

router.delete(
  "/admin/metrics/:key",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteMetricDefinition
);

module.exports = router;
