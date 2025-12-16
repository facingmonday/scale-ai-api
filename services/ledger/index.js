const express = require("express");
const controller = require("./ledger.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
} = require("../../middleware/auth");

// All routes require org:admin role
router.use(requireAuth(), checkRole("org:admin"));

// Get ledger history for a user
router.get("/:classId/user/:userId", controller.getLedgerHistory);

// Get ledger entries for a scenario
router.get("/scenario/:scenarioId", controller.getLedgerEntriesByScenario);

// Get ledger entry for a specific scenario and user
router.get("/scenario/:scenarioId/user/:userId", controller.getLedgerEntry);

// Override a ledger entry
router.patch("/:ledgerId/override", controller.overrideLedgerEntry);

module.exports = router;

