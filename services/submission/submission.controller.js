const mongoose = require("mongoose");
const Submission = require("./submission.model");
const Scenario = require("../scenario/scenario.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");

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
    const isEnrolled = await Enrollment.isUserEnrolled(classId, member._id);

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
    if (
      error.message === "Scenario not found" ||
      error.message === "Class not found"
    ) {
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
 * Get all submissions for the authenticated student
 * GET /api/student/submissions?classroomId=...&scenarioId=...
 */
exports.getStudentSubmissions = async function (req, res) {
  try {
    const { classroomId, scenarioId } = req.query;
    const member = req.user;

    if (classroomId && !mongoose.Types.ObjectId.isValid(classroomId)) {
      return res.status(400).json({ error: "classroomId must be a valid id" });
    }
    if (scenarioId && !mongoose.Types.ObjectId.isValid(scenarioId)) {
      return res.status(400).json({ error: "scenarioId must be a valid id" });
    }

    let submissions = [];

    if (classroomId) {
      // Verify enrollment
      const isEnrolled = await Enrollment.isUserEnrolled(
        classroomId,
        member._id
      );
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this class" });
      }

      submissions = await Submission.getSubmissionsByUser(
        classroomId,
        member._id
      );
    } else {
      // Get all enrolled classrooms
      const enrollments = await Enrollment.getEnrollmentsByUser(member._id);

      const classIdMap = new Map();
      for (const enrollment of enrollments) {
        if (enrollment?.classId) {
          classIdMap.set(enrollment.classId.toString(), enrollment.classId);
        }
      }
      const classIds = [...classIdMap.values()];

      if (classIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const submissionsByClass = await Promise.all(
        classIds.map((classId) =>
          Submission.getSubmissionsByUser(classId, member._id)
        )
      );

      submissions = submissionsByClass.flat();
    }

    // Optional filter by scenarioId
    if (scenarioId) {
      submissions = submissions.filter(
        (s) => s?.scenarioId?.toString() === scenarioId.toString()
      );
    }

    // Batch-load classroom + scenario metadata for response hydration
    const uniqueClassIds = [
      ...new Set(
        submissions.map((s) => s?.classId?.toString()).filter(Boolean)
      ),
    ];
    const uniqueScenarioIds = [
      ...new Set(
        submissions.map((s) => s?.scenarioId?.toString()).filter(Boolean)
      ),
    ];

    const [classrooms, scenarios] = await Promise.all([
      uniqueClassIds.length > 0
        ? Classroom.find({ _id: { $in: uniqueClassIds } }).select("_id name")
        : [],
      uniqueScenarioIds.length > 0
        ? Scenario.find({ _id: { $in: uniqueScenarioIds } }).select(
            "_id title week isPublished isClosed"
          )
        : [],
    ]);

    const classroomById = new Map(classrooms.map((c) => [c._id.toString(), c]));
    const scenarioById = new Map(scenarios.map((s) => [s._id.toString(), s]));

    const toScenarioStatus = (scenarioDoc) => {
      if (!scenarioDoc) return null;
      if (scenarioDoc.isClosed) return "closed";
      if (scenarioDoc.isPublished) return "published";
      return "draft";
    };

    const data = submissions
      .map((submission) => {
        const classroom = submission?.classId
          ? classroomById.get(submission.classId.toString())
          : null;
        const scenario = submission?.scenarioId
          ? scenarioById.get(submission.scenarioId.toString())
          : null;

        return {
          ...submission,
          classroom: classroom
            ? { _id: classroom._id, name: classroom.name }
            : null,
          scenario: scenario
            ? {
                _id: scenario._id,
                name: scenario.title,
                weekNumber: scenario.week,
                status: toScenarioStatus(scenario),
              }
            : null,
        };
      })
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error getting student submissions:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid id provided" });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all submissions for scenario (admin)
 * GET /api/admin/scenarios/:scenarioId/submissions
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
    await Classroom.validateAdminAccess(classId, clerkUserId, organizationId);

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
