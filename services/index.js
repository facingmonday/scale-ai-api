/**
 * Main Services Router
 *
 * Mounts all service routers at their respective paths.
 * This router is mounted at /v1 in the main API application.
 * All routes defined here will be accessible at /v1/[service-path]
 */
const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth"));
router.use("/members", require("./members"));
router.use("/organizations", require("./organizations"));
router.use("/notifications", require("./notifications"));
router.use("/openai", require("./openai")); // Remove direct access to openai
//router.use("/workers", require("./workers"));

// Public join route (idempotent)
router.use("/join", require("./join"));

// Classroom routes
router.use("/admin/class", require("./classroom"));

// Enrollment routes
router.use("/enrollment", require("./enrollment"));

// Store routes
router.use("/", require("./store"));

// VariableDefinition routes
router.use("/", require("./variableDefinition"));

// StoreType routes
router.use("/", require("./storeType"));

// ClassroomTemplate routes
router.use("/", require("./classroomTemplate"));

// Scenario routes
router.use("/", require("./scenario"));

// ScenarioOutcome routes
router.use("/", require("./scenarioOutcome"));

// Submission routes
router.use("/", require("./submission"));

// Ledger routes
router.use("/admin/ledger", require("./ledger"));

// Job routes
router.use("/admin/job", require("./job"));

module.exports = router;
