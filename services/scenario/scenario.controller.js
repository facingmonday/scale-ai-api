const Scenario = require("./scenario.model");
const ScenarioOutcome = require("../scenarioOutcome/scenarioOutcome.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");
const Submission = require("../submission/submission.model");
const { enqueueEmailSending } = require("../../lib/queues/email-worker");
const JobService = require("../job/lib/jobService");
const LedgerService = require("../ledger/lib/ledgerService");
const SimulationWorker = require("../job/lib/simulationWorker");

/**
 * Get all scenarios
 * GET /api/admin/scenarios
 */
exports.getScenarios = async function (req, res) {
  try {
    const classroomId = req.query.classroomId;
    const scenarios = await Scenario.find({ classroomId });
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

    // Queue email notifications to all enrolled students (async, don't block response)
    queueScenarioCreatedEmails(scenario, classroomId, organizationId).catch(
      (error) => {
        console.error("Error queueing scenario created emails:", error);
        // Don't throw - we don't want to fail scenario creation if emails fail
      }
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
    await LedgerService.deleteLedgerEntriesForScenario(scenarioId);

    // 2. Reset all jobs for this scenario
    await JobService.resetJobsForScenario(scenarioId);

    // 3. Recreate jobs for all submissions
    const jobs = await JobService.createJobsForScenario(
      scenarioId,
      scenario.classroomId,
      false, // dryRun = false
      organizationId,
      clerkUserId
    );

    // Process jobs asynchronously
    SimulationWorker.processPendingJobs(10).catch((error) => {
      console.error("Error processing jobs after rerun:", error);
    });

    res.json({
      success: true,
      message: "Scenario rerun initiated. Jobs created and processing started.",
      data: {
        scenario: scenario.toObject(),
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
 * Queue email notifications for scenario creation
 * @param {Object} scenario - Scenario document
 * @param {string} classroomId - Class ID
 * @param {string} organizationId - Organization ID
 */
async function queueScenarioCreatedEmails(
  scenario,
  classroomId,
  organizationId
) {
  try {
    // Get classroom details
    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      console.error("Classroom not found for scenario email notification");
      return;
    }

    // Get all enrolled students (members only, not admins)
    const enrollments = await Enrollment.findByClass(classroomId);
    const memberEnrollments = enrollments.filter((e) => e.role === "member");

    if (memberEnrollments.length === 0) {
      console.log("No enrolled students to notify about scenario creation");
      return;
    }

    // Get member details and queue emails
    const host =
      process.env.SCALE_COM_HOST ||
      process.env.SCALE_API_HOST ||
      "https://scale.ai";
    const scenarioLink = `${host}/class/${classroomId}/scenario/${scenario._id}`;

    const emailPromises = memberEnrollments.map(async (enrollment) => {
      try {
        // Get member details
        const member = await Member.findById(enrollment.userId);
        if (!member) {
          console.warn(`Member not found for enrollment ${enrollment._id}`);
          return;
        }

        // Get email from Clerk
        const email = await member.getEmailFromClerk();
        if (!email) {
          console.warn(`No email found for member ${member._id}`);
          return;
        }

        // Queue email job
        await enqueueEmailSending({
          recipient: {
            email,
            name:
              `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
              email,
            memberId: member._id,
          },
          title: `New Scenario: ${scenario.title}`,
          message: `A new scenario "${scenario.title}" has been added to ${classroom.name}.`,
          templateSlug: "ScenarioCreatedEmail",
          templateData: {
            scenario: {
              _id: scenario._id,
              title: scenario.title,
              description: scenario.description,
              link: scenarioLink,
            },
            classroom: {
              _id: classroom._id,
              name: classroom.name,
              description: classroom.description,
            },
            member: {
              _id: member._id,
              firstName: member.firstName,
              lastName: member.lastName,
              name: `${member.firstName || ""} ${member.lastName || ""}`.trim(),
              email,
              clerkUserId: member.clerkUserId,
            },
            organization: {
              _id: organizationId,
            },
            link: scenarioLink,
            env: {
              SCALE_COM_HOST: host,
              SCALE_API_HOST: process.env.SCALE_API_HOST || host,
            },
          },
          organizationId,
        });

        console.log(`📧 Queued scenario created email for ${email}`);
      } catch (error) {
        console.error(
          `Error queueing email for enrollment ${enrollment._id}:`,
          error.message
        );
        // Continue with other emails even if one fails
      }
    });

    await Promise.allSettled(emailPromises);
    console.log(
      `✅ Queued ${memberEnrollments.length} scenario created email(s)`
    );
  } catch (error) {
    console.error("Error in queueScenarioCreatedEmails:", error);
    throw error;
  }
}

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
        const ledgerEntry = await LedgerService.getLedgerEntry(
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
    const ledgerEntry = await LedgerService.getLedgerEntry(
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
