const Scenario = require("./scenario.model");
const ScenarioOutcome = require("../scenarioOutcome/scenarioOutcome.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Submission = require("../submission/submission.model");
const JobService = require("../job/lib/jobService");
const LedgerEntry = require("../ledger/ledger.model");
const SimulationWorker = require("../job/lib/simulationWorker");

/**
 * Get all scenarios
 * GET /api/admin/scenarios
 */
exports.getScenarios = async function (req, res) {
  try {
    const classroomId = req.query.classroomId;
    const scenarios = await Scenario.find({ classroomId, week: { $ne: 0 } });
    res.status(200).json({
      success: true,
      data: scenarios,
    });
  } catch (error) {
    console.error("Error getting scenarios:", error);
    res.status(500).json({ error: error.message });
  }
};

/** Get scenario by id */
exports.getScenarioById = async function (req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.organization?._id;

    // Use static method which handles variable loading
    const scenario = await Scenario.getScenarioById(id, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    res.status(200).json({ success: true, data: scenario });
  } catch (error) {
    console.error("Error getting scenario by id:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create scenario
 * POST /api/admin/scenario
 */
exports.createScenario = async function (req, res) {
  try {
    const { classroomId, title, description, variables } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Validate required fields
    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Create scenario using static method
    const scenario = await Scenario.createScenario(
      classroomId,
      { title, description, variables },
      organizationId,
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Scenario created successfully",
      data: scenario,
    });
  } catch (error) {
    console.error("Error creating scenario:", error);
    if (error.message.includes("Invalid scenario variables")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update scenario
 * PUT /api/admin/scenarios/:scenarioId
 */
exports.updateScenario = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario (get Mongoose document, not plain object)
    const query = { _id: scenarioId };
    if (organizationId) {
      query.organization = organizationId;
    }
    const scenario = await Scenario.findOne(query);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classroomId,
      clerkUserId,
      organizationId
    );

    // Check if can be edited
    if (!scenario.canEdit()) {
      return res.status(400).json({
        error:
          "Scenario cannot be edited after it has been published and closed",
      });
    }

    // Update allowed fields (excluding variables)
    const allowedFields = ["title", "description"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        scenario[field] = req.body[field];
      }
    });

    // Update variables if provided
    if (req.body.variables !== undefined) {
      await scenario.updateVariables(
        req.body.variables,
        organizationId,
        clerkUserId
      );
    }

    scenario.updatedBy = clerkUserId;
    await scenario.save();

    // Reload variables to ensure they're in the cache
    await scenario._loadVariables();

    // Convert to object with variables included
    const updatedScenario = scenario.toObject();

    res.json({
      success: true,
      message: "Scenario updated successfully",
      data: updatedScenario,
    });
  } catch (error) {
    console.error("Error updating scenario:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Publish scenario
 * POST /api/admin/scenarios/:scenarioId/publish
 */
exports.publishScenario = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario as Mongoose document (needed for instance methods)
    const scenario = await Scenario.findOne({
      _id: scenarioId,
      organization: organizationId,
    });

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classroomId,
      clerkUserId,
      organizationId
    );

    // Pre-publish validation: Check if scenario can be published
    if (scenario.isPublished) {
      return res.status(400).json({
        error: "Scenario is already published",
      });
    }

    if (scenario.isClosed) {
      return res.status(400).json({
        error: "Cannot publish a closed scenario",
      });
    }

    // Pre-publish validation: Check if another scenario is already active
    const activeScenario = await Scenario.getActiveScenario(
      scenario.classroomId
    );
    if (
      activeScenario &&
      activeScenario._id.toString() !== scenario._id.toString()
    ) {
      return res.status(400).json({
        error: `Another scenario is already active ("${activeScenario.title}"). Please unpublish or close the active scenario before publishing a new one.`,
        activeScenarioId: activeScenario._id,
        activeScenarioTitle: activeScenario.title,
      });
    }

    // Publish scenario
    await scenario.publish(clerkUserId);

    // TODO: Notify students (email notification)

    res.json({
      success: true,
      message: "Scenario published successfully",
      data: scenario,
    });
  } catch (error) {
    console.error("Error publishing scenario:", error);
    if (error.message.includes("already published")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Unpublish scenario
 * POST /api/admin/scenarios/:scenarioId/unpublish
 */
exports.unpublishScenario = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario as Mongoose document (needed for instance methods)
    const scenario = await Scenario.findOne({
      _id: scenarioId,
      organization: organizationId,
    });

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classroomId,
      clerkUserId,
      organizationId
    );

    // Check if scenario is published
    if (!scenario.isPublished) {
      return res.status(400).json({
        error: "Scenario is not published",
      });
    }

    // Check if scenario is closed
    if (scenario.isClosed) {
      return res.status(400).json({
        error: "Cannot unpublish a closed scenario",
      });
    }

    // Unpublish scenario
    await scenario.unpublish(clerkUserId);

    res.json({
      success: true,
      message: "Scenario unpublished successfully",
      data: scenario,
    });
  } catch (error) {
    console.error("Error unpublishing scenario:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Preview AI outcomes (placeholder)
 * POST /api/admin/scenarios/:scenarioId/preview
 */
exports.previewScenario = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classroomId,
      clerkUserId,
      organizationId
    );

    // Get outcome
    const outcome = await ScenarioOutcome.getOutcomeByScenario(scenarioId);

    if (!outcome) {
      return res.status(400).json({
        error: "Scenario outcome must be set before previewing",
      });
    }

    // Create preview jobs (dryRun = true)
    const jobs = await JobService.createJobsForScenario(
      scenarioId,
      scenario.classroomId,
      true, // dryRun
      organizationId,
      clerkUserId
    );

    // Process preview jobs synchronously (limited to first 5 for preview)
    const previewJobs = jobs.slice(0, 5);
    const previewResults = [];

    for (const job of previewJobs) {
      try {
        const result = await SimulationWorker.processJob(job._id);
        previewResults.push({
          userId: job.userId,
          result: result.result,
        });
      } catch (error) {
        console.error(`Error processing preview job ${job._id}:`, error);
        previewResults.push({
          userId: job.userId,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: "Preview completed",
      data: {
        scenario: scenario.toObject(),
        outcome: outcome.toObject(),
        previewResults,
        totalJobs: jobs.length,
        previewedJobs: previewResults.length,
      },
    });
  } catch (error) {
    console.error("Error previewing scenario:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Rerun scenario (placeholder)
 * POST /api/admin/scenarios/:scenarioId/rerun
 */
exports.rerunScenario = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find scenario
    const scenario = await Scenario.getScenarioById(scenarioId, organizationId);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      scenario.classroomId,
      clerkUserId,
      organizationId
    );

    // Get outcome
    const outcome = await ScenarioOutcome.getOutcomeByScenario(scenarioId);

    if (!outcome) {
      return res.status(400).json({
        error: "Scenario outcome must be set before rerunning",
      });
    }

    // 1. Delete existing ledger entries for this scenario
    await LedgerEntry.deleteLedgerEntriesForScenario(scenarioId);

    // 2. Reset all jobs for this scenario
    await JobService.resetJobsForScenario(scenarioId);

    // 3. Recreate jobs for all submissions
    // Jobs are automatically enqueued to Bull queue by createJobsForScenario -> createJob
    // The Bull queue worker will process them asynchronously
    const jobs = await JobService.createJobsForScenario(
      scenarioId,
      scenario.classroomId,
      false, // dryRun = false
      organizationId,
      clerkUserId
    );

    res.json({
      success: true,
      message:
        "Scenario rerun initiated. Jobs created and queued for processing.",
      data: {
        scenario: scenario, // getScenarioById already returns a plain object
        jobsCreated: jobs.length,
      },
    });
  } catch (error) {
    console.error("Error rerunning scenario:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get current scenario (student-facing)
 * GET /api/student/scenario/current
 */
exports.getCurrentScenario = async function (req, res) {
  try {
    const { classroomId } = req.query;
    const member = req.user;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    // Verify enrollment
    const isEnrolled = await Enrollment.isUserEnrolled(classroomId, member._id);

    if (!isEnrolled) {
      return res.status(403).json({
        error: "Not enrolled in this class",
      });
    }

    // Get active scenario
    const scenario = await Scenario.getActiveScenario(classroomId);

    if (!scenario) {
      return res.status(404).json({ error: "No active scenario found" });
    }

    // Get submission status for this student
    const submission = await Submission.getSubmission(
      classroomId,
      scenario._id,
      member._id
    );

    const submissionStatus = submission
      ? {
          submitted: true,
          submittedAt: submission.submittedAt,
        }
      : {
          submitted: false,
          submittedAt: null,
        };

    res.json({
      success: true,
      data: {
        scenario: {
          id: scenario._id,
          title: scenario.title,
          description: scenario.description,
          variables: scenario.variables,
          isPublished: scenario.isPublished,
          isClosed: scenario.isClosed,
          week: scenario.week,
        },
        submissionStatus,
      },
    });
  } catch (error) {
    console.error("Error getting current scenario:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get current scenario (admin-facing)
 * GET /api/admin/scenarios/current
 */
exports.getCurrentScenarioForAdmin = async function (req, res) {
  try {
    const { classroomId } = req.query;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get active scenario
    const scenario = await Scenario.getActiveScenario(classroomId);

    if (!scenario) {
      return res.status(404).json({ error: "No active scenario found" });
    }

    res.json({
      success: true,
      data: {
        scenario: {
          id: scenario._id,
          title: scenario.title,
          description: scenario.description,
          variables: scenario.variables,
          isPublished: scenario.isPublished,
          isClosed: scenario.isClosed,
        },
      },
    });
  } catch (error) {
    console.error("Error getting current scenario for admin:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get student scenarios by classroom
 * GET /api/student/scenarios
 */
exports.getStudentScenariosByClassroom = async function (req, res) {
  try {
    const { classroomId: classroomId } = req.query;
    const member = req.user;

    if (!classroomId) {
      return res.status(400).json({ error: "classroomId is required" });
    }

    // Verify enrollment
    const isEnrolled = await Enrollment.isUserEnrolled(classroomId, member._id);
    if (!isEnrolled) {
      return res.status(403).json({ error: "Not enrolled in this class" });
    }

    // Get all scenarios for the classroom
    const scenarios = await Scenario.getScenariosByClass(classroomId, {
      includeClosed: true,
    });

    // For each scenario, fetch submission, outcome, and ledger entry
    const scenariosWithData = await Promise.all(
      scenarios.map(async (scenario) => {
        // Get member submission with variables for this scenario
        const submission = await Submission.getSubmission(
          classroomId,
          scenario._id,
          member._id
        );

        // Get scenario outcome
        const outcome = await ScenarioOutcome.getOutcomeByScenario(
          scenario._id
        );

        // Get ledger entry for this scenario and member
        const ledgerEntry = await LedgerEntry.getLedgerEntry(
          scenario._id,
          member._id
        );

        return {
          ...scenario,
          submission: submission || null,
          outcome: outcome || null,
          ledgerEntry: ledgerEntry || null,
        };
      })
    );

    res.json({
      success: true,
      data: scenariosWithData,
    });
  } catch (error) {
    console.error("Error getting student scenarios by classroom:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid id provided" });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get scenario by id for student
 * GET /api/student/scenarios/:id
 */
exports.getScenarioByIdForStudent = async function (req, res) {
  try {
    const { id } = req.params;
    const member = req.user;

    // Get scenario by id (without organizationId for students)
    const scenario = await Scenario.getScenarioById(id);

    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    // Verify enrollment
    const isEnrolled = await Enrollment.isUserEnrolled(
      scenario.classroomId,
      member._id
    );
    if (!isEnrolled) {
      return res.status(403).json({ error: "Not enrolled in this class" });
    }

    // Get member submission with variables for this scenario
    const submission = await Submission.getSubmission(
      scenario.classroomId,
      scenario._id,
      member._id
    );

    console.log("submission", submission);

    // Get scenario outcome
    const outcome = await ScenarioOutcome.getOutcomeByScenario(scenario._id);

    // Get ledger entry for this scenario and member
    const ledgerEntry = await LedgerEntry.getLedgerEntry(
      scenario._id,
      member._id
    );

    res.json({
      success: true,
      data: {
        ...scenario,
        submission: submission || null,
        outcome: outcome || null,
        ledgerEntry: ledgerEntry || null,
      },
    });
  } catch (error) {
    console.error("Error getting scenario by id for student:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid id provided" });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete scenario
 * DELETE /api/admin/scenarios/:scenarioId
 */
exports.deleteScenario = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    await Scenario.findByIdAndDelete(scenarioId);
    res.json({
      success: true,
      message: "Scenario deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting scenario:", error);
    res.status(500).json({ error: error.message });
  }
};
