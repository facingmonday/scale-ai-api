const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth"));
router.use("/me", require("./me"));
router.use("/members", require("./members"));
router.use("/organizations", require("./organizations"));
router.use("/notifications", require("./notifications"));
router.use("/openai", require("./openai")); // Remove direct access to openai
router.use("/utils", require("./utils"));
//router.use("/workers", require("./workers"));

// Classroom routes
router.use("/admin/class", require("./classroom"));

// Enrollment routes
router.use("/", require("./enrollment"));

// Store routes
router.use("/", require("./store"));

// VariableDefinition routes
router.use("/", require("./variableDefinition"));

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
