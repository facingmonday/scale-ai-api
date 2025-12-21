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

    // Get scenario to get classroomId
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    const classroomId = scenario.classroomId;

    // Verify enrollment
    const isEnrolled = await Enrollment.isUserEnrolled(classroomId, member._id);

    if (!isEnrolled) {
      return res.status(403).json({
        error: "User is not enrolled in this class",
      });
    }

    // Get organization from class
    const Classroom = require("../classroom/classroom.model");
    const classDoc = await Classroom.findById(classroomId);
    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    const organizationId = classDoc.organization;

    // Create submission using static method
    const submission = await Submission.createSubmission(
      classroomId,
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
 * Update weekly decisions
 * PUT /api/student/submission
 */
exports.updateWeeklyDecisions = async function (req, res) {
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

    // Get scenario to get classroomId
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    const classroomId = scenario.classroomId;

    // Verify enrollment
    const isEnrolled = await Enrollment.isUserEnrolled(classroomId, member._id);
    if (!isEnrolled) {
      return res
        .status(403)
        .json({ error: "User is not enrolled in this class" });
    }

    // Get organization from class
    const Classroom = require("../classroom/classroom.model");
    const classDoc = await Classroom.findById(classroomId);
    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    const organizationId = classDoc.organization;

    // Update submission using static method
    const submission = await Submission.updateSubmission(
      classroomId,
      scenarioId,
      member._id,
      variables,
      organizationId,
      clerkUserId
    );

    res.json({
      success: true,
      message: "Submission updated successfully",
      data: submission,
    });
  } catch (error) {
    console.error("Error updating weekly decisions:", error);
    if (error.message === "Scenario not found") {
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

    // Get scenario to get classroomId
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    const classroomId = scenario.classroomId;

    // Get submission
    const submission = await Submission.getSubmission(
      classroomId,
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

      const classroomIdMap = new Map();
      for (const enrollment of enrollments) {
        if (enrollment?.classroomId) {
          classroomIdMap.set(
            enrollment.classroomId.toString(),
            enrollment.classroomId
          );
        }
      }
      const classroomIds = [...classroomIdMap.values()];

      if (classroomIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const submissionsByClass = await Promise.all(
        classroomIds.map((classroomId) =>
          Submission.getSubmissionsByUser(classroomId, member._id)
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
        submissions.map((s) => s?.classroomId?.toString()).filter(Boolean)
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
        const classroom = submission?.classroomId
          ? classroomById.get(submission.classroomId.toString())
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

    // Get scenario to get classroomId
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    const classroomId = scenario.classroomId;

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get all submissions
    const submissions = await Submission.getSubmissionsByScenario(scenarioId);

    // Get missing submissions
    const missingUserIds = await Submission.getMissingSubmissions(
      classroomId,
      scenarioId
    );

    // Get user details for missing submissions
    const Member = require("../members/member.model");
    const missingUsers = await Member.find({
      _id: { $in: missingUserIds },
    }).select("_id firstName lastName maskedEmail clerkUserId");

    res.json({
      success: true,
      data: {
        submissions,
        missingSubmissions: missingUsers.map((u) => ({
          ...u.toObject(),
          email: u.maskedEmail,
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

/**
 * Get a single submission by ID (admin)
 * GET /api/admin/submission/:submissionId
 */
exports.getSubmission = async function (req, res) {
  try {
    const { submissionId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ error: "Invalid submission ID" });
    }

    // Get submission
    const submission = await Submission.findById(submissionId).populate({
      path: "userId",
      select: "_id clerkUserId firstName lastName maskedEmail",
    });

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Verify admin access to the classroom
    await Classroom.validateAdminAccess(
      submission.classroomId,
      clerkUserId,
      organizationId
    );

    // Populate variables
    await submission.populateVariables();
    const submissionObj = submission.toObject();

    // Convert variables object to array forma
    res.json({
      success: true,
      data: {
        ...submissionObj,
        member: submission.userId
          ? {
              _id: submission.userId._id,
              clerkUserId: submission.userId.clerkUserId,
              email: submission.userId.maskedEmail,
              firstName: submission.userId.firstName,
              lastName: submission.userId.lastName,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error getting submission:", error);
    if (error.message === "Submission not found") {
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

/**
 * Get all submissions with query params and pagination (admin)
 * GET /api/admin/submissions?classroomId=...&scenarioId=...&userId=...&page=0&pageSize=50
 */
exports.getSubmissions = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 50;

    // Parse query filters
    const query = { organization: organizationId };

    if (req.query.classroomId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.classroomId)) {
        return res.status(400).json({ error: "Invalid classroomId" });
      }
      query.classroomId = req.query.classroomId;

      // Verify admin access to the classroom
      await Classroom.validateAdminAccess(
        req.query.classroomId,
        clerkUserId,
        organizationId
      );
    }

    if (req.query.scenarioId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.scenarioId)) {
        return res.status(400).json({ error: "Invalid scenarioId" });
      }
      query.scenarioId = req.query.scenarioId;
    }

    if (req.query.userId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json({ error: "Invalid userId" });
      }
      query.userId = req.query.userId;
    }

    // If classroomId is provided, verify access
    // If not provided but other filters are, we need to verify access for each result
    if (!req.query.classroomId && (req.query.scenarioId || req.query.userId)) {
      // If scenarioId is provided, get classroomId from scenario
      if (req.query.scenarioId) {
        const scenario = await Scenario.findById(req.query.scenarioId);
        if (!scenario) {
          return res.status(404).json({ error: "Scenario not found" });
        }
        await Classroom.validateAdminAccess(
          scenario.classroomId,
          clerkUserId,
          organizationId
        );
        query.classroomId = scenario.classroomId;
      }
    }

    // Get total count
    const totalCount = await Submission.countDocuments(query);

    // Apply pagination
    const skip = page * pageSize;
    const submissions = await Submission.find(query)
      .populate({
        path: "userId",
        select: "_id clerkUserId firstName lastName maskedEmail",
      })
      .populate({
        path: "scenarioId",
        select: "_id title week isPublished isClosed",
      })
      .populate({
        path: "classroomId",
        select: "_id name",
      })
      .sort({ submittedAt: -1 })
      .limit(pageSize)
      .skip(skip);

    // Populate variables for all submissions
    await Submission.populateVariablesForMany(submissions);

    // Format submissions
    const formattedSubmissions = submissions.map((submission) => {
      const submissionObj = submission.toObject();

      return {
        ...submissionObj,
        member: submission.userId
          ? {
              _id: submission.userId._id,
              clerkUserId: submission.userId.clerkUserId,
              email: submission.userId.maskedEmail,
              firstName: submission.userId.firstName,
              lastName: submission.userId.lastName,
            }
          : null,
        scenario: submission.scenarioId
          ? {
              _id: submission.scenarioId._id,
              title: submission.scenarioId.title,
              week: submission.scenarioId.week,
              isPublished: submission.scenarioId.isPublished,
              isClosed: submission.scenarioId.isClosed,
            }
          : null,
        classroom: submission.classroomId
          ? {
              _id: submission.classroomId._id,
              name: submission.classroomId.name,
            }
          : null,
      };
    });

    const hasMore = skip + pageSize < totalCount;

    res.json({
      success: true,
      page,
      pageSize,
      total: totalCount,
      hasMore,
      data: formattedSubmissions,
    });
  } catch (error) {
    console.error("Error getting submissions:", error);
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
