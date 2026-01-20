const mongoose = require("mongoose");
const Submission = require("./submission.model");
const Scenario = require("../scenario/scenario.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");
const LedgerEntry = require("../ledger/ledger.model");
const Store = require("../store/store.model");

// ---- helpers ----

function isSafePath(path) {
  // Allow "a", "a.b.c", etc.
  // Disallow anything that starts with "$" or contains "$." segments
  if (typeof path !== "string" || !path.trim()) return false;
  if (path.startsWith("$")) return false;
  if (path.split(".").some((p) => p.startsWith("$"))) return false;
  return true;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function coerceValue(v) {
  // Convert valid ObjectId strings to ObjectId; leave everything else as-is
  if (typeof v === "string" && mongoose.Types.ObjectId.isValid(v)) {
    return new mongoose.Types.ObjectId(v);
  }
  if (Array.isArray(v)) return v.map(coerceValue);
  return v;
}

function buildMatchCondition(field, operator, value) {
  const v = coerceValue(value);

  switch (operator) {
    case "eq":
      return { [field]: v };
    case "ne":
      return { [field]: { $ne: v } };
    case "in":
      return { [field]: { $in: Array.isArray(v) ? v : [v] } };
    case "nin":
      return { [field]: { $nin: Array.isArray(v) ? v : [v] } };
    case "gt":
      return { [field]: { $gt: v } };
    case "gte":
      return { [field]: { $gte: v } };
    case "lt":
      return { [field]: { $lt: v } };
    case "lte":
      return { [field]: { $lte: v } };
    case "exists":
      return { [field]: { $exists: Boolean(v) } };
    case "contains": {
      const s = String(v ?? "");
      return { [field]: { $regex: escapeRegex(s), $options: "i" } };
    }
    case "startsWith": {
      const s = String(v ?? "");
      return { [field]: { $regex: `^${escapeRegex(s)}`, $options: "i" } };
    }
    case "endsWith": {
      const s = String(v ?? "");
      return { [field]: { $regex: `${escapeRegex(s)}$`, $options: "i" } };
    }
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

function shouldLookupJobs({ filters, sortField, includeJobs }) {
  if (includeJobs) return true;
  if (typeof sortField === "string" && sortField.startsWith("jobs.")) return true;
  if (Array.isArray(filters)) {
    return filters.some((f) => typeof f?.field === "string" && f.field.startsWith("jobs."));
  }
  return false;
}

function isPostLookupField(field) {
  // Heuristic: anything referencing these joined/virtual namespaces
  return (
    field.startsWith("member.") ||
    field.startsWith("store.") ||
    field.startsWith("ledger.") ||
    field.startsWith("scenario.") ||
    field.startsWith("classroom.") ||
    field.startsWith("jobs.")
  );
}

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
 * Query params:
 *   - page: Page number (default: 0)
 *   - pageSize: Items per page (default: 50)
 *   - status: Filter by "submitted" or "missing" (optional)
 *   - search: Search by member name or email (optional)
 *   - storeType: Filter by store type ID (optional)
 *   - generationMethod: Filter by submission generation method (MANUAL, AI, FORWARDED_PREVIOUS, etc.) (optional)
 *   - sortBy: Field to sort by (default: "submittedAt")
 *   - sortOrder: "asc" or "desc" (default: "desc")
 */
exports.getSubmissionsForScenario = async function (req, res) {
  try {
    const { scenarioId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 50;

    // Parse filter parameters
    const searchTerm = req.query.search; // Search by name or email
    const storeTypeFilter = req.query.storeType; // Store type ID
    const generationMethodFilter = req.query.generationMethod; // Generation method

    // Parse sort parameters
    const sortBy = req.query.sortBy || "submittedAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

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
    const allSubmissions = await Submission.getSubmissionsByScenario(scenarioId);

    // Fetch stores for all submissions and format
    let submissionsWithStores = await Promise.all(
      allSubmissions.map(async (submission) => {
        const store =
          submission.member && submission.member._id
            ? await Store.getStoreByUser(classroomId, submission.member._id)
            : null;
        return {
          ...submission,
          store: store,
        };
      })
    );

    // Apply filters
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      submissionsWithStores = submissionsWithStores.filter((sub) => {
        const member = sub.member;
        if (!member) return false;
        const firstName = (member.firstName || "").toLowerCase();
        const lastName = (member.lastName || "").toLowerCase();
        const email = (member.email || "").toLowerCase();
        return (
          firstName.includes(searchLower) ||
          lastName.includes(searchLower) ||
          email.includes(searchLower) ||
          `${firstName} ${lastName}`.includes(searchLower)
        );
      });
    }

    if (storeTypeFilter) {
      submissionsWithStores = submissionsWithStores.filter((sub) => {
        return (
          sub.store &&
          sub.store.storeType &&
          sub.store.storeType.toString() === storeTypeFilter
        );
      });
    }

    if (generationMethodFilter) {
      submissionsWithStores = submissionsWithStores.filter((sub) => {
        return (
          sub.generation &&
          sub.generation.method === generationMethodFilter
        );
      });
    }

    // Apply sorting
    const sortField = sortBy;
    if (sortField === "submittedAt") {
      submissionsWithStores.sort((a, b) => {
        const dateA = a.submittedAt ? new Date(a.submittedAt) : new Date(0);
        const dateB = b.submittedAt ? new Date(b.submittedAt) : new Date(0);
        return (dateB - dateA) * sortOrder;
      });
    } else if (sortField === "name") {
      submissionsWithStores.sort((a, b) => {
        const nameA = `${a.member?.firstName || ""} ${a.member?.lastName || ""}`.trim() || "";
        const nameB = `${b.member?.firstName || ""} ${b.member?.lastName || ""}`.trim() || "";
        return nameA.localeCompare(nameB) * sortOrder;
      });
    } else if (sortField === "email") {
      submissionsWithStores.sort((a, b) => {
        const emailA = (a.member?.email || "").toLowerCase();
        const emailB = (b.member?.email || "").toLowerCase();
        return emailA.localeCompare(emailB) * sortOrder;
      });
    }

    // Apply pagination
    const totalCount = submissionsWithStores.length;
    const skip = page * pageSize;
    const paginatedResults = submissionsWithStores.slice(skip, skip + pageSize);
    const hasMore = skip + pageSize < totalCount;

    res.json({
      success: true,
      page,
      pageSize,
      total: totalCount,
      hasMore,
      data: {
        submissions: paginatedResults,
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
 * Get missing submissions for a scenario
 * GET /api/admin/scenarios/:scenarioId/submissions/missing
 */
exports.getMissingSubmissionsForScenario = async function (req, res) {
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

    // Get missing submissions
    const missingUserIds = await Submission.getMissingSubmissions(
      classroomId,
      scenarioId
    );

    // Get user details for missing submissions (lightweight query)
    const missingUsers = await Member.find({
      _id: { $in: missingUserIds },
    })
      .select("_id firstName lastName clerkUserId")
      .lean();

    // Get stores for missing users only (lightweight query)
    const stores = await Store.find({
      classroomId,
      userId: { $in: missingUserIds },
    })
      .select("_id userId shopName studentId")
      .lean();

    // Create a map of userId -> store for quick lookup
    const storeMap = new Map();
    stores.forEach((store) => {
      const userId = store.userId?.toString
        ? store.userId.toString()
        : String(store.userId);
      storeMap.set(userId, {
        _id: store._id,
        shopName: store.shopName,
        studentId: store.studentId,
      });
    });

    // Format missing submissions (lightweight response)
    const missingSubmissions = missingUsers.map((user) => {
      const userId = user._id.toString();
      const store = storeMap.get(userId) || null;

      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        clerkUserId: user.clerkUserId,
        studentId: store?.studentId || null,
        store: store
          ? {
              _id: store._id,
              shopName: store.shopName,
              studentId: store.studentId,
            }
          : null,
      };
    });

    res.json({
      success: true,
      data: {
        missingSubmissions,
      },
    });
  } catch (error) {
    console.error("Error getting missing submissions for scenario:", error);
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
 * POST /api/admin/submissions/search
 * Body:
 * {
 *   classroomId: string (required),
 *   page?: number (default 0),
 *   pageSize?: number (default 50),
 *   sortField?: string (default "submittedAt"),
 *   sortDirection?: "asc"|"desc" (default "desc"),
 *   filters?: Array<{ field: string, operator: string, value: any }>,
 *   includeJobs?: boolean (default true),
 * }
 */
exports.getSubmissions = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    const {
      classroomId,
      page = 0,
      pageSize = 50,
      sortField = "submittedAt",
      sortDirection = "desc",
      filters = [],
      includeJobs = true,
    } = req.body || {};

    if (!classroomId || !mongoose.Types.ObjectId.isValid(classroomId)) {
      return res.status(400).json({ error: "classroomId is required and must be a valid ObjectId" });
    }

    // Verify admin access once, since classroomId is required scope
    await Classroom.validateAdminAccess(classroomId, clerkUserId, organizationId);

    const pageNum = Math.max(parseInt(page, 10) || 0, 0);
    const size = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 200);
    const skip = pageNum * size;

    if (!isSafePath(sortField)) {
      return res.status(400).json({ error: "Invalid sortField" });
    }
    const sortDir = sortDirection === "asc" ? 1 : -1;

    // Build match stages from filters (split into pre/post lookup for performance)
    const preLookupMatches = [];
    const postLookupMatches = [];

    const allowedOperators = new Set([
      "eq",
      "ne",
      "in",
      "nin",
      "gt",
      "gte",
      "lt",
      "lte",
      "contains",
      "startsWith",
      "endsWith",
      "exists",
    ]);

    if (Array.isArray(filters)) {
      for (const f of filters) {
        if (!f) continue;
        const field = f.field;
        const operator = f.operator;
        const value = f.value;

        if (!isSafePath(field)) {
          return res.status(400).json({ error: `Invalid filter field: ${field}` });
        }
        if (!allowedOperators.has(operator)) {
          return res.status(400).json({ error: `Unsupported operator: ${operator}` });
        }

        // Map your preferred aliases (optional convenience)
        // memberId -> userId, storeName -> store.shopName, studentId -> store.studentId
        let normalizedField = field;
        if (field === "memberId") normalizedField = "userId";
        if (field === "storeName") normalizedField = "store.shopName";
        if (field === "studentId") normalizedField = "store.studentId";
        if (field === "netProfit") normalizedField = "ledger.netProfit";

        const condition = buildMatchCondition(normalizedField, operator, value);

        if (isPostLookupField(normalizedField)) postLookupMatches.push(condition);
        else preLookupMatches.push(condition);
      }
    }

    const includeJobsLookup = shouldLookupJobs({
      filters,
      sortField,
      includeJobs,
    });

    // Collection names (safe even if you rename models)
    const membersCollection = Member.collection.name;
    const scenariosCollection = Scenario.collection.name;
    const classroomsCollection = Classroom.collection.name;
    const storesCollection = Store.collection.name;
    const ledgersCollection = LedgerEntry.collection.name;

    // Base match (hard scope)
    const baseMatch = {
      organization: organizationId,
      classroomId: new mongoose.Types.ObjectId(classroomId),
    };

    const pipeline = [
      { $match: baseMatch },

      // Apply submission-native filters early
      ...(preLookupMatches.length ? [{ $match: { $and: preLookupMatches } }] : []),

      // ---- lookups ----

      // member (Submission.userId -> Member)
      {
        $lookup: {
          from: membersCollection,
          localField: "userId",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },

      // scenario (Submission.scenarioId -> Scenario)
      {
        $lookup: {
          from: scenariosCollection,
          localField: "scenarioId",
          foreignField: "_id",
          as: "scenario",
        },
      },
      { $unwind: { path: "$scenario", preserveNullAndEmptyArrays: true } },

      // classroom (Submission.classroomId -> Classroom)
      {
        $lookup: {
          from: classroomsCollection,
          localField: "classroomId",
          foreignField: "_id",
          as: "classroom",
        },
      },
      { $unwind: { path: "$classroom", preserveNullAndEmptyArrays: true } },

      // store (by classroomId + userId)
      {
        $lookup: {
          from: storesCollection,
          let: { cId: "$classroomId", uId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$classroomId", "$$cId"] }, { $eq: ["$userId", "$$uId"] }],
                },
              },
            },
            // If there can be multiple, you can decide how to pick:
            // { $sort: { createdDate: -1 } },
            { $limit: 1 },
          ],
          as: "store",
        },
      },
      { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },

      // ledger (Submission.ledgerEntryId -> LedgerEntry)
      {
        $lookup: {
          from: ledgersCollection,
          localField: "ledgerEntryId",
          foreignField: "_id",
          as: "ledger",
        },
      },
      { $unwind: { path: "$ledger", preserveNullAndEmptyArrays: true } },


      // Apply filters that depend on lookups
      ...(postLookupMatches.length ? [{ $match: { $and: postLookupMatches } }] : []),

      // Dynamic sort (with tie-breaker for stable paging)
      {
        $sort: {
          [sortField]: sortDir,
          _id: 1,
        },
      },

      // Facet: data + total
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: size },

            // Project into a predictable response shape.
            // Keep submission doc fields at root so we can hydrate it for variables.
            {
              $project: {
                generation: 1,
                _id: 1,
                classroomId: 1,
                scenarioId: 1,
                userId: 1,
                submittedAt: 1,
                ledgerEntryId: 1,
                processingStatus: 1,
                organization: 1,
                createdBy: 1,
                updatedBy: 1,
                createdDate: 1,
                updatedDate: 1,

                // Joined fields (namespaced)
                member: {
                  _id: "$member._id",
                  clerkUserId: "$member.clerkUserId",
                  firstName: "$member.firstName",
                  lastName: "$member.lastName",
                  maskedEmail: "$member.maskedEmail",
                },
                store: "$store",
                ledger: "$ledger",
                scenario: {
                  _id: "$scenario._id",
                  title: "$scenario.title",
                  isPublished: "$scenario.isPublished",
                  isClosed: "$scenario.isClosed",
                },
                classroom: {
                  _id: "$classroom._id",
                  name: "$classroom.name",
                },
                jobs: includeJobsLookup
                  ? {
                      $map: {
                        input: "$jobs",
                        as: "j",
                        in: {
                          _id: "$$j._id",
                          status: "$$j.status",
                          error: "$$j.error",
                          attempts: "$$j.attempts",
                          startedAt: "$$j.startedAt",
                          completedAt: "$$j.completedAt",
                          dryRun: "$$j.dryRun",
                        },
                      },
                    }
                  : 1,
              },
            },
          ],
          meta: [{ $count: "total" }],
        },
      },
    ];

    const aggResult = await Submission.aggregate(pipeline);
    const data = aggResult?.[0]?.data || [];
    const total = aggResult?.[0]?.meta?.[0]?.total || 0;

    // ---- populate variables via existing helper ----
    // We hydrate each row into a Submission doc to reuse your existing population logic.
    const hydrated = data.map((row) => Submission.hydrate(row));
    await Submission.populateVariablesForMany(hydrated);

    // Merge variables back into rows
    const rowsWithVariables = data.map((row, idx) => {
      const submissionDoc = hydrated[idx];
      const submissionObj = submissionDoc.toObject();

      // generation guard (like your existing controller)
      const generation =
        submissionObj.generation && typeof submissionObj.generation === "object"
          ? {
              ...submissionObj.generation,
              method: submissionObj.generation.method || "MANUAL",
            }
          : { method: "MANUAL" };

      return {
        ...row,
        generation,
        variables: submissionObj.variables || {},
        // Backwards-compat / convenience fields like your existing endpoint:
        member: row.member
          ? {
              _id: row.member._id,
              clerkUserId: row.member.clerkUserId,
              email: row.member.maskedEmail,
              firstName: row.member.firstName,
              lastName: row.member.lastName,
            }
          : null,
        processingStatus: row.processingStatus || "pending",
      };
    });

    const hasMore = skip + size < total;

    return res.json({
      success: true,
      classroomId,
      page: pageNum,
      pageSize: size,
      total,
      hasMore,
      sortField,
      sortDirection: sortDirection === "asc" ? "asc" : "desc",
      filters,
      data: rowsWithVariables,
    });
  } catch (error) {
    console.error("Error searching submissions:", error);

    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
};