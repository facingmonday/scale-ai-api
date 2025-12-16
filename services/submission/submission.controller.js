const Submission = require("./submission.model");
const Scenario = require("../scenario/scenario.model");
const classroomService = require("../classroom/lib/classroomService");
const enrollmentService = require("../enrollment/lib/enrollmentService");

/**
 * Submit weekly decisions
 * POST /api/student/submission
 */
exports.submitWeeklyDecisions = async function (req, res) {
  try {
    const { scenarioId, variables } = req.body;
    const member = req.user;
    const clerkUserId = req.clerkUser.id;

    // Validate required fields
    if (!scenarioId) {
      return res.status(400).json({ error: "scenarioId is required" });
    }
    if (!variables || typeof variables !== "object") {
      return res.status(400).json({ error: "variables object is required" });
    }

    // Get scenario to get classId
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    const classId = scenario.classId;

    // Verify enrollment
    const isEnrolled = await enrollmentService.isUserEnrolled(
      classId,
      member._id
    );

    if (!isEnrolled) {
      return res.status(403).json({
        error: "User is not enrolled in this class",
      });
    }

    // Get organization from class
    const Classroom = require("../classroom/classroom.model");
    const classDoc = await Classroom.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    const organizationId = classDoc.organization;

    // Create submission using static method
    const submission = await Submission.createSubmission(
      classId,
      scenarioId,
      member._id,
      variables,
      organizationId,
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Submission created successfully",
      data: submission,
    });
  } catch (error) {
    console.error("Error creating submission:", error);
    if (
      error.message === "Submission already exists for this scenario" ||
      error.message.includes("Cannot submit out of order") ||
      error.message.includes("Invalid submission variables") ||
      error.message === "Scenario is not published" ||
      error.message === "Scenario is closed"
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Scenario not found" || error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get submission status
 * GET /api/student/submission/status?scenarioId=...
 */
exports.getSubmissionStatus = async function (req, res) {
  try {
    const { scenarioId } = req.query;
    const member = req.user;

    if (!scenarioId) {
      return res.status(400).json({
        error: "scenarioId query parameter is required",
      });
    }

    // Get scenario to get classId
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    const classId = scenario.classId;

    // Get submission
    const submission = await Submission.getSubmission(
      classId,
      scenarioId,
      member._id
    );

    if (!submission) {
      return res.json({
        success: true,
        data: {
          submitted: false,
          submittedAt: null,
        },
      });
    }

    res.json({
      success: true,
      data: {
        submitted: true,
        submittedAt: submission.submittedAt,
      },
    });
  } catch (error) {
    console.error("Error getting submission status:", error);
    if (error.message === "Scenario not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all submissions for scenario (admin)
 * GET /api/admin/scenario/:scenarioId/submissions
 */
exports.getSubmissionsForScenario = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Get scenario to get classId
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    const classId = scenario.classId;

    // Verify admin access
    await classroomService.validateAdminAccess(
      classId,
      clerkUserId,
      organizationId
    );

    // Get all submissions
    const submissions = await Submission.getSubmissionsByScenario(scenarioId);

    // Get missing submissions
    const missingUserIds = await Submission.getMissingSubmissions(
      classId,
      scenarioId
    );

    // Get user details for missing submissions
    const Member = require("../members/member.model");
    const missingUsers = await Member.find({
      _id: { $in: missingUserIds },
    }).select("_id firstName lastName clerkUserId");

    res.json({
      success: true,
      data: {
        submissions: submissions.map((s) => ({
          userId: s.userId,
          clerkUserId: s.clerkUserId,
          variables: s.variables,
          submittedAt: s.submittedAt,
        })),
        missingSubmissions: missingUsers.map((u) => ({
          userId: u._id,
          clerkUserId: u.clerkUserId,
          firstName: u.firstName,
          lastName: u.lastName,
        })),
        totalEnrolled: submissions.length + missingUsers.length,
        submittedCount: submissions.length,
        missingCount: missingUsers.length,
      },
    });
  } catch (error) {
    console.error("Error getting submissions for scenario:", error);
    if (error.message === "Scenario not found") {
      return res.status(404).json({ error: error.message });
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

