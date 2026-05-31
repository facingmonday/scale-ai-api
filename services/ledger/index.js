/**
 * Ledger Service Routes
 *
 * Provides endpoints for managing ledger entries (historical results for students).
 * Mounted at: /v1/admin/ledger
 *
 * The ledger entry now profiles a dynamic `metrics` map keyed by MetricDefinition
 * records for the classroom, rather than a fixed set of fields.
 */
const express = require("express");
const controller = require("./ledger.controller");
const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

// Get ledger history for a user
router.get(
  "/:classroomId/user/:userId",
  requireAuth(),
  checkRole(["org:admin", "org:member"]),
  controller.getLedgerHistory
);

// Get ledger entries for a challenge
router.get(
  "/challenge/:challengeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getLedgerEntriesByChallenge
);

// Get ledger entry for a specific challenge and user
router.get(
  "/challenge/:challengeId/user/:userId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getLedgerEntry
);

// Override a ledger entry
router.patch(
  "/:ledgerId/override",
  requireAuth(),
  checkRole("org:admin"),
  controller.overrideLedgerEntry
);

module.exports = router;
