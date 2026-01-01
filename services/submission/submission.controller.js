const mongoose = require("mongoose");
const Submission = require("./submission.model");
const Scenario = require("../scenario/scenario.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");
const LedgerEntry = require("../ledger/ledger.model");
const Store = require("../store/store.model");

/**
 * Submit scenario decisions
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
 * Update scenario decisions
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
    console.error("Error updating scenario decisions:", error);
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
 * GET /api/student/submissions?classroomId=...&studentId=...
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
            "_id title isPublished isClosed"
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
    // Note: getMissingSubmissions already filters by org:member role, so we just fetch by ID
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
 * Get all submissions and associated ledger entries for a student
 * GET /api/student/submissions/:studentId
 * Note: studentId in the URL is a Clerk user ID
 */
exports.getAllSubmissionsForUser = async function (req, res) {
  try {
    const { studentId } = req.params;

    // Convert Clerk user ID to Member ID
    const member = await Member.findById(studentId);

    if (!member) {
      return res.status(403).json({ error: "Member not found" });
    }

    // Get all enrollments for this user
    const enrollments = await Enrollment.getEnrollmentsByUser(member._id);

    // Get unique classroom IDs from enrollments
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
      return res.json({
        success: true,
        data: { submissions: [], ledgerEntries: [] },
      });
    }

    // Get submissions from all classrooms
    const submissionsByClass = await Promise.all(
      classroomIds.map((classroomId) =>
        Submission.getSubmissionsByUser(classroomId, member._id)
      )
    );

    let submissions = submissionsByClass.flat();

    // Get all scenario IDs from submissions
    const scenarioIds = [
      ...new Set(
        submissions.map((s) => s?.scenarioId?.toString()).filter(Boolean)
      ),
    ];

    // Get ledger entries for all scenarios
    const ledgerEntriesByScenario = await Promise.all(
      scenarioIds.map((scenarioId) =>
        LedgerEntry.getLedgerEntry(scenarioId, member._id)
      )
    );

    // Create a map of ledger entries by scenarioId for easy lookup
    const ledgerByScenarioId = new Map();
    ledgerEntriesByScenario.forEach((entry) => {
      if (entry && entry.scenarioId) {
        ledgerByScenarioId.set(entry.scenarioId.toString(), entry);
      }
    });

    // Also get ledger entries by submissionId (in case they're linked directly)
    const submissionIds = submissions
      .map((s) => s?._id?.toString())
      .filter(Boolean);

    const ledgerEntriesBySubmission = await Promise.all(
      submissionIds.map((submissionId) =>
        LedgerEntry.findOne({ submissionId }).lean()
      )
    );

    // Create a map of ledger entries by submissionId
    const ledgerBySubmissionId = new Map();
    ledgerEntriesBySubmission.forEach((entry) => {
      if (entry && entry.submissionId) {
        ledgerBySubmissionId.set(entry.submissionId.toString(), entry);
      }
    });

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
            "_id title isPublished isClosed"
          )
        : [],
    ]);

    const classroomById = new Map(classrooms.map((c) => [c._id.toString(), c]));
    const scenarioById = new Map(scenarios.map((s) => [s._id.toString(), s]));

    // Check if calculation details are requested (optional query parameter)
    const includeCalculationDetails =
      req.query.includeCalculationDetails === "true";
    // NOTE: Do NOT redeclare LedgerEntry here.
    // This function already uses the top-level LedgerEntry import above.
    // Redeclaring with `const LedgerEntry = ...` creates a TDZ bug:
    // "Cannot access 'LedgerEntry' before initialization".

    // Format submissions with their associated ledger entries
    let formattedSubmissions = submissions.map((submission) => {
      const classroom = submission?.classroomId
        ? classroomById.get(submission.classroomId.toString())
        : null;
      const scenario = submission?.scenarioId
        ? scenarioById.get(submission.scenarioId.toString())
        : null;

      // Get ledger entry - prefer by submissionId, fallback to scenarioId
      let ledgerEntry =
        ledgerBySubmissionId.get(submission._id.toString()) ||
        (submission.scenarioId
          ? ledgerByScenarioId.get(submission.scenarioId.toString())
          : null);

      // LedgerEntry can be either:
      // - a Mongoose document (from LedgerEntry.getLedgerEntry())
      // - a plain object (from .lean())
      // Normalize to a plain JSON-safe object.
      const ledgerEntryObj =
        ledgerEntry && typeof ledgerEntry.toObject === "function"
          ? ledgerEntry.toObject()
          : ledgerEntry || null;

      return {
        ...submission,
        classroom: classroom
          ? { _id: classroom._id, name: classroom.name }
          : null,
        scenario: scenario
          ? {
              _id: scenario._id,
              title: scenario.title,
              isPublished: scenario.isPublished,
              isClosed: scenario.isClosed,
            }
          : null,
        ledgerEntry: ledgerEntryObj,
      };
    });

    // If calculation details are requested, fetch them for each ledger entry
    if (includeCalculationDetails) {
      const detailsPromises = formattedSubmissions.map(async (submission) => {
        if (submission.ledgerEntry && submission.ledgerEntry._id) {
          const details = await LedgerEntry.getCalculationDetails(
            submission.ledgerEntry._id
          );
          if (details) {
            submission.ledgerEntry.calculationDetails =
              details.calculationContext;
            submission.ledgerEntry.variableDefinitions =
              details.variableDefinitions;
          }
        }
        return submission;
      });
      formattedSubmissions = await Promise.all(detailsPromises);
    }

    // Get all unique ledger entries (combine both maps)
    const allLedgerEntries = [
      ...new Map(
        [
          ...Array.from(ledgerBySubmissionId.values()),
          ...Array.from(ledgerByScenarioId.values()),
        ].map((entry) => [entry._id.toString(), entry])
      ).values(),
    ];

    res.json({
      success: true,
      data: formattedSubmissions.sort(
        (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
      ),
    });
  } catch (error) {
    console.error("Error getting all submissions for student:", error);
    if (error.message === "Member not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid id provided" });
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
    const submission = await Submission.findById(submissionId)
      .populate({
        path: "userId",
        select: "_id clerkUserId firstName lastName maskedEmail",
      })
      .populate({
        path: "jobs",
        select: "_id status error attempts startedAt completedAt dryRun",
      })
      .populate({
        path: "ledgerEntryId",
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

    // Get user's store for this classroom
    const store = submission.userId
      ? await Store.getStoreByUser(
          submission.classroomId,
          submission.userId._id
        )
      : null;

    // Check if calculation details are requested (optional query parameter)
    const includeCalculationDetails =
      req.query.includeCalculationDetails === "true";
    // NOTE: Do NOT redeclare LedgerEntry here (see comment above).

    // Get ledger entry with optional calculation details
    let ledgerEntryData = submission.ledgerEntryId
      ? submission.ledgerEntryId.toObject()
      : null;

    // Convert Map fields in calculationContext to plain objects
    // Mongoose Maps need to be converted to plain objects for JSON serialization
    if (ledgerEntryData && ledgerEntryData.calculationContext) {
      const convertMapToObject = (mapValue) => {
        if (!mapValue) return {};
        // If it's already a plain object, return it
        if (typeof mapValue === "object" && !(mapValue instanceof Map)) {
          return mapValue;
        }
        // If it's a Map, convert it
        if (mapValue instanceof Map) {
          return Object.fromEntries(mapValue);
        }
        return {};
      };

      ledgerEntryData.calculationContext = {
        storeVariables: convertMapToObject(
          ledgerEntryData.calculationContext.storeVariables
        ),
        scenarioVariables: convertMapToObject(
          ledgerEntryData.calculationContext.scenarioVariables
        ),
        submissionVariables: convertMapToObject(
          ledgerEntryData.calculationContext.submissionVariables
        ),
        outcomeVariables: convertMapToObject(
          ledgerEntryData.calculationContext.outcomeVariables
        ),
        priorState: ledgerEntryData.calculationContext.priorState || {},
        prompt: ledgerEntryData.calculationContext.prompt || null,
      };
    }

    if (ledgerEntryData && includeCalculationDetails) {
      const details = await LedgerEntry.getCalculationDetails(
        submission.ledgerEntryId._id
      );
      if (details) {
        ledgerEntryData.calculationDetails = details.calculationContext;
        ledgerEntryData.variableDefinitions = details.variableDefinitions;
      }
    }

    // Remove ledgerEntryId from response to avoid duplication
    // Keep only ledgerEntry with the full populated data
    const { ledgerEntryId, ...submissionData } = submissionObj;

    res.json({
      success: true,
      data: {
        ...submissionData,
        ledgerEntry: ledgerEntryData,
        member: submission.userId
          ? {
              _id: submission.userId._id,
              clerkUserId: submission.userId.clerkUserId,
              email: submission.userId.maskedEmail,
              firstName: submission.userId.firstName,
              lastName: submission.userId.lastName,
            }
          : null,
        store: store,
        jobs: submissionObj.jobs || [],
        processingStatus: submissionObj.processingStatus || "pending",
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
        select: "_id title isPublished isClosed",
      })
      .populate({
        path: "classroomId",
        select: "_id name",
      })
      .populate({
        path: "jobs",
        select: "_id status error attempts startedAt completedAt dryRun",
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
        jobs: submissionObj.jobs || [],
        processingStatus: submissionObj.processingStatus || "pending",
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
