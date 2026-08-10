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
router.use("/ai", require("./ai"));
router.use("/files", require("./files"));
router.use("/folders", require("./folders"));
router.use("/tags", require("./tags"));
router.use("/licensing", require("./licensing"));
//router.use("/workers", require("./workers"));

// Public join route (idempotent)
router.use("/join", require("./join"));

// Classroom routes
router.use("/admin/class", require("./classroom"));
router.use("/student/class", require("./classroom/student"));

// Enrollment routes
router.use("/enrollment", require("./enrollment"));

// Profile routes
router.use("/", require("./profile"));

// VariableDefinition routes
router.use("/", require("./variableDefinition"));

// MetricDefinition routes
router.use("/", require("./metricDefinition"));

// ProfileType routes
router.use("/", require("./profileType"));

// ClassroomTemplate routes
router.use("/", require("./classroomTemplate"));

// Challenge routes
router.use("/", require("./challenge"));

// Outcome routes
router.use("/", require("./outcome"));

// Decision routes
router.use("/", require("./decision"));

// Ledger routes
router.use("/admin/ledger", require("./ledger"));

// Job routes
router.use("/admin/job", require("./job"));

module.exports = router;
