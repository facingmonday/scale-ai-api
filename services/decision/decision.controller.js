const mongoose = require("mongoose");
const Decision = require("./decision.model");
const Challenge = require("../challenge/challenge.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");
const LedgerEntry = require("../ledger/ledger.model");
const Profile = require("../profile/profile.model");

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
    field.startsWith("profile.") ||
    field.startsWith("ledger.") ||
    field.startsWith("challenge.") ||
    field.startsWith("classroom.") ||
    field.startsWith("jobs.")
  );
}

/**
 * Submit challenge decisions
 * POST /api/student/decision
 */
exports.submitWeeklyDecisions = async function (req, res) {
  try {
    const { challengeId, variables } = req.body;
    const member = req.user;
    const clerkUserId = req.clerkUser.id;

    // Validate required fields
    if (!challengeId) {
      return res.status(400).json({ error: "challengeId is required" });
    }
    if (!variables || typeof variables !== "object") {
      return res.status(400).json({ error: "variables object is required" });
    }

    // Get challenge to get classroomId
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const classroomId = challenge.classroomId;

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

    // Create decision using static method
    const decision = await Decision.createSubmission(
      classroomId,
      challengeId,
      member._id,
      variables,
      organizationId,
      clerkUserId
    );

    res.status(201).json({
      success: true,
      message: "Decision created successfully",
      data: decision,
    });
  } catch (error) {
    console.error("Error creating decision:", error);
    if (
      error.message === "Decision already exists for this challenge" ||
      error.message.includes("Cannot submit out of order") ||
      error.message.includes("Invalid decision variables") ||
      error.message === "Challenge is not published" ||
      error.message === "Challenge is closed"
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (
      error.message === "Challenge not found" ||
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
 * Update challenge decisions
 * PUT /api/student/decision
 */
exports.updateWeeklyDecisions = async function (req, res) {
  try {
    const { challengeId, variables } = req.body;
    const member = req.user;
    const clerkUserId = req.clerkUser.id;

    // Validate required fields
    if (!challengeId) {
      return res.status(400).json({ error: "challengeId is required" });
    }
    if (!variables || typeof variables !== "object") {
      return res.status(400).json({ error: "variables object is required" });
    }

    // Get challenge to get classroomId
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const classroomId = challenge.classroomId;

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

    // Update decision using static method
    const decision = await Decision.updateSubmission(
      classroomId,
      challengeId,
      member._id,
      variables,
      organizationId,
      clerkUserId
    );

    res.json({
      success: true,
      message: "Decision updated successfully",
      data: decision,
    });
  } catch (error) {
    console.error("Error updating challenge decisions:", error);
    if (error.message === "Challenge not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get decision status
 * GET /api/student/decision/status?challengeId=...
 */
exports.getSubmissionStatus = async function (req, res) {
  try {
    const { challengeId } = req.query;
    const member = req.user;

    if (!challengeId) {
      return res.status(400).json({
        error: "challengeId query parameter is required",
      });
    }

    // Get challenge to get classroomId
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const classroomId = challenge.classroomId;

    // Get decision
    const decision = await Decision.getSubmission(
      classroomId,
      challengeId,
      member._id
    );

    if (!decision) {
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
        submittedAt: decision.submittedAt,
      },
    });
  } catch (error) {
    console.error("Error getting decision status:", error);
    if (error.message === "Challenge not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all decisions for the authenticated student
 * GET /api/student/decisions?classroomId=...&studentId=...
 */
exports.getStudentSubmissions = async function (req, res) {
  try {
    const { classroomId, challengeId } = req.query;
    const member = req.user;

    if (classroomId && !mongoose.Types.ObjectId.isValid(classroomId)) {
      return res.status(400).json({ error: "classroomId must be a valid id" });
    }
    if (challengeId && !mongoose.Types.ObjectId.isValid(challengeId)) {
      return res.status(400).json({ error: "challengeId must be a valid id" });
    }

    let decisions = [];

    if (classroomId) {
      // Verify enrollment
      const isEnrolled = await Enrollment.isUserEnrolled(
        classroomId,
        member._id
      );
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this class" });
      }

      decisions = await Decision.getSubmissionsByUser(
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
          Decision.getSubmissionsByUser(classroomId, member._id)
        )
      );

      decisions = submissionsByClass.flat();
    }

    // Optional filter by challengeId
    if (challengeId) {
      decisions = decisions.filter(
        (s) => s?.challengeId?.toString() === challengeId.toString()
      );
    }

    // Batch-load classroom + challenge metadata for response hydration
    const uniqueClassIds = [
      ...new Set(
        decisions.map((s) => s?.classroomId?.toString()).filter(Boolean)
      ),
    ];
    const uniqueScenarioIds = [
      ...new Set(
        decisions.map((s) => s?.challengeId?.toString()).filter(Boolean)
      ),
    ];

    const [classrooms, challenges] = await Promise.all([
      uniqueClassIds.length > 0
        ? Classroom.find({ _id: { $in: uniqueClassIds } }).select("_id name")
        : [],
      uniqueScenarioIds.length > 0
        ? Challenge.find({ _id: { $in: uniqueScenarioIds } }).select(
            "_id title isPublished isClosed"
          )
        : [],
    ]);

    const classroomById = new Map(classrooms.map((c) => [c._id.toString(), c]));
    const scenarioById = new Map(challenges.map((s) => [s._id.toString(), s]));

    const toScenarioStatus = (scenarioDoc) => {
      if (!scenarioDoc) return null;
      if (scenarioDoc.isClosed) return "closed";
      if (scenarioDoc.isPublished) return "published";
      return "draft";
    };

    const data = decisions
      .map((decision) => {
        const classroom = decision?.classroomId
          ? classroomById.get(decision.classroomId.toString())
          : null;
        const challenge = decision?.challengeId
          ? scenarioById.get(decision.challengeId.toString())
          : null;

        return {
          ...decision,
          classroom: classroom
            ? { _id: classroom._id, name: classroom.name }
            : null,
          challenge: challenge
            ? {
                _id: challenge._id,
                name: challenge.title,
                status: toScenarioStatus(challenge),
              }
            : null,
        };
      })
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error getting student decisions:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid id provided" });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all decisions for challenge (admin)
 * GET /api/admin/challenges/:challengeId/decisions
 * Query params:
 *   - page: Page number (default: 0)
 *   - pageSize: Items per page (default: 50)
 *   - status: Filter by "submitted" or "missing" (optional)
 *   - search: Search by member name or email (optional)
 *   - profileType: Filter by profile type ID (optional)
 *   - generationMethod: Filter by decision generation method (MANUAL, AI, FORWARDED_PREVIOUS, etc.) (optional)
 *   - sortBy: Field to sort by (default: "submittedAt")
 *   - sortOrder: "asc" or "desc" (default: "desc")
 */
exports.getSubmissionsForScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 50;

    // Parse filter parameters
    const searchTerm = req.query.search; // Search by name or email
    const storeTypeFilter = req.query.profileType; // Profile type ID
    const generationMethodFilter = req.query.generationMethod; // Generation method

    // Parse sort parameters
    const sortBy = req.query.sortBy || "submittedAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // Get challenge to get classroomId
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const classroomId = challenge.classroomId;

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get all decisions
    const allSubmissions = await Decision.getSubmissionsByScenario(challengeId);

    // Fetch profiles for all decisions and format
    let submissionsWithStores = await Promise.all(
      allSubmissions.map(async (decision) => {
        const profile =
          decision.member && decision.member._id
            ? await Profile.getStoreByUser(classroomId, decision.member._id)
            : null;
        return {
          ...decision,
          profile: profile,
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
          sub.profile &&
          sub.profile.profileType &&
          sub.profile.profileType.toString() === storeTypeFilter
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
        decisions: paginatedResults,
      },
    });
  } catch (error) {
    console.error("Error getting decisions for challenge:", error);
    if (error.message === "Challenge not found") {
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
 * Get missing decisions for a challenge
 * GET /api/admin/challenges/:challengeId/decisions/missing
 */
exports.getMissingSubmissionsForScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Get challenge to get classroomId
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const classroomId = challenge.classroomId;

    // Verify admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get missing decisions
    const missingUserIds = await Decision.getMissingSubmissions(
      classroomId,
      challengeId
    );

    // Get user details for missing decisions (lightweight query)
    const missingUsers = await Member.find({
      _id: { $in: missingUserIds },
    })
      .select("_id firstName lastName clerkUserId")
      .lean();

    // Get profiles for missing users only (lightweight query)
    const profiles = await Profile.find({
      classroomId,
      userId: { $in: missingUserIds },
    })
      .select("_id userId shopName studentId")
      .lean();

    // Create a map of userId -> profile for quick lookup
    const storeMap = new Map();
    profiles.forEach((profile) => {
      const userId = profile.userId?.toString
        ? profile.userId.toString()
        : String(profile.userId);
      storeMap.set(userId, {
        _id: profile._id,
        shopName: profile.shopName,
        studentId: profile.studentId,
      });
    });

    // Format missing decisions (lightweight response)
    const missingSubmissions = missingUsers.map((user) => {
      const userId = user._id.toString();
      const profile = storeMap.get(userId) || null;

      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        clerkUserId: user.clerkUserId,
        studentId: profile?.studentId || null,
        profile: profile
          ? {
              _id: profile._id,
              shopName: profile.shopName,
              studentId: profile.studentId,
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
    console.error("Error getting missing decisions for challenge:", error);
    if (error.message === "Challenge not found") {
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
 * Get all decisions and associated ledger entries for a student
 * GET /api/student/decisions/:studentId
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
        data: { decisions: [], ledgerEntries: [] },
      });
    }

    // Get decisions from all classrooms
    const submissionsByClass = await Promise.all(
      classroomIds.map((classroomId) =>
        Decision.getSubmissionsByUser(classroomId, member._id)
      )
    );

    let decisions = submissionsByClass.flat();

    // Get all challenge IDs from decisions
    const scenarioIds = [
      ...new Set(
        decisions.map((s) => s?.challengeId?.toString()).filter(Boolean)
      ),
    ];

    // Get ledger entries for all challenges
    const ledgerEntriesByScenario = await Promise.all(
      scenarioIds.map((challengeId) =>
        LedgerEntry.getLedgerEntry(challengeId, member._id)
      )
    );

    // Create a map of ledger entries by challengeId for easy lookup
    const ledgerByScenarioId = new Map();
    ledgerEntriesByScenario.forEach((entry) => {
      if (entry && entry.challengeId) {
        ledgerByScenarioId.set(entry.challengeId.toString(), entry);
      }
    });

    // Also get ledger entries by decisionId (in case they're linked directly)
    const submissionIds = decisions
      .map((s) => s?._id?.toString())
      .filter(Boolean);

    const ledgerEntriesBySubmission = await Promise.all(
      submissionIds.map((decisionId) =>
        LedgerEntry.findOne({ decisionId }).lean()
      )
    );

    // Create a map of ledger entries by decisionId
    const ledgerBySubmissionId = new Map();
    ledgerEntriesBySubmission.forEach((entry) => {
      if (entry && entry.decisionId) {
        ledgerBySubmissionId.set(entry.decisionId.toString(), entry);
      }
    });

    // Batch-load classroom + challenge metadata for response hydration
    const uniqueClassIds = [
      ...new Set(
        decisions.map((s) => s?.classroomId?.toString()).filter(Boolean)
      ),
    ];
    const uniqueScenarioIds = [
      ...new Set(
        decisions.map((s) => s?.challengeId?.toString()).filter(Boolean)
      ),
    ];

    const [classrooms, challenges] = await Promise.all([
      uniqueClassIds.length > 0
        ? Classroom.find({ _id: { $in: uniqueClassIds } }).select("_id name")
        : [],
      uniqueScenarioIds.length > 0
        ? Challenge.find({ _id: { $in: uniqueScenarioIds } }).select(
            "_id title isPublished isClosed"
          )
        : [],
    ]);

    const classroomById = new Map(classrooms.map((c) => [c._id.toString(), c]));
    const scenarioById = new Map(challenges.map((s) => [s._id.toString(), s]));

    // Check if calculation details are requested (optional query parameter)
    const includeCalculationDetails =
      req.query.includeCalculationDetails === "true";
    // NOTE: Do NOT redeclare LedgerEntry here.
    // This function already uses the top-level LedgerEntry import above.
    // Redeclaring with `const LedgerEntry = ...` creates a TDZ bug:
    // "Cannot access 'LedgerEntry' before initialization".

    // Format decisions with their associated ledger entries
    let formattedSubmissions = decisions.map((decision) => {
      const classroom = decision?.classroomId
        ? classroomById.get(decision.classroomId.toString())
        : null;
      const challenge = decision?.challengeId
        ? scenarioById.get(decision.challengeId.toString())
        : null;

      // Get ledger entry - prefer by decisionId, fallback to challengeId
      let ledgerEntry =
        ledgerBySubmissionId.get(decision._id.toString()) ||
        (decision.challengeId
          ? ledgerByScenarioId.get(decision.challengeId.toString())
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
        ...decision,
        classroom: classroom
          ? { _id: classroom._id, name: classroom.name }
          : null,
        challenge: challenge
          ? {
              _id: challenge._id,
              title: challenge.title,
              isPublished: challenge.isPublished,
              isClosed: challenge.isClosed,
            }
          : null,
        ledgerEntry: ledgerEntryObj,
      };
    });

    // If calculation details are requested, fetch them for each ledger entry
    if (includeCalculationDetails) {
      const detailsPromises = formattedSubmissions.map(async (decision) => {
        if (decision.ledgerEntry && decision.ledgerEntry._id) {
          const details = await LedgerEntry.getCalculationDetails(
            decision.ledgerEntry._id
          );
          if (details) {
            decision.ledgerEntry.calculationDetails =
              details.calculationContext;
            decision.ledgerEntry.variableDefinitions =
              details.variableDefinitions;
          }
        }
        return decision;
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
    console.error("Error getting all decisions for student:", error);
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
 * Get a single decision by ID (admin)
 * GET /api/admin/decision/:decisionId
 */
exports.getSubmission = async function (req, res) {
  try {
    const { decisionId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!mongoose.Types.ObjectId.isValid(decisionId)) {
      return res.status(400).json({ error: "Invalid decision ID" });
    }

    // Get decision
    const decision = await Decision.findById(decisionId)
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

    if (!decision) {
      return res.status(404).json({ error: "Decision not found" });
    }

    // Verify admin access to the classroom
    await Classroom.validateAdminAccess(
      decision.classroomId,
      clerkUserId,
      organizationId
    );

    // Populate variables
    await decision.populateVariables();
    const submissionObj = decision.toObject();

    // Get user's profile for this classroom
    const profile = decision.userId
      ? await Profile.getStoreByUser(
          decision.classroomId,
          decision.userId._id
        )
      : null;

    // Check if calculation details are requested (optional query parameter)
    const includeCalculationDetails =
      req.query.includeCalculationDetails === "true";
    // NOTE: Do NOT redeclare LedgerEntry here (see comment above).

    // Get ledger entry with optional calculation details
    let ledgerEntryData = decision.ledgerEntryId
      ? decision.ledgerEntryId.toObject()
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
        decision.ledgerEntryId._id
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
        member: decision.userId
          ? {
              _id: decision.userId._id,
              clerkUserId: decision.userId.clerkUserId,
              email: decision.userId.maskedEmail,
              firstName: decision.userId.firstName,
              lastName: decision.userId.lastName,
            }
          : null,
        profile: profile,
        jobs: submissionObj.jobs || [],
        processingStatus: submissionObj.processingStatus || "pending",
      },
    });
  } catch (error) {
    console.error("Error getting decision:", error);
    if (error.message === "Decision not found") {
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
 * POST /api/admin/decisions/search
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
        // memberId -> userId, storeName -> profile.shopName, studentId -> profile.studentId
        let normalizedField = field;
        if (field === "memberId") normalizedField = "userId";
        if (field === "storeName") normalizedField = "profile.shopName";
        if (field === "studentId") normalizedField = "profile.studentId";

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
    const scenariosCollection = Challenge.collection.name;
    const classroomsCollection = Classroom.collection.name;
    const storesCollection = Profile.collection.name;
    const ledgersCollection = LedgerEntry.collection.name;

    // Base match (hard scope)
    const baseMatch = {
      organization: organizationId,
      classroomId: new mongoose.Types.ObjectId(classroomId),
    };

    const pipeline = [
      { $match: baseMatch },

      // Apply decision-native filters early
      ...(preLookupMatches.length ? [{ $match: { $and: preLookupMatches } }] : []),

      // ---- lookups ----

      // member (Decision.userId -> Member)
      {
        $lookup: {
          from: membersCollection,
          localField: "userId",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },

      // challenge (Decision.challengeId -> Challenge)
      {
        $lookup: {
          from: scenariosCollection,
          localField: "challengeId",
          foreignField: "_id",
          as: "challenge",
        },
      },
      { $unwind: { path: "$challenge", preserveNullAndEmptyArrays: true } },

      // classroom (Decision.classroomId -> Classroom)
      {
        $lookup: {
          from: classroomsCollection,
          localField: "classroomId",
          foreignField: "_id",
          as: "classroom",
        },
      },
      { $unwind: { path: "$classroom", preserveNullAndEmptyArrays: true } },

      // profile (by classroomId + userId)
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
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      // ledger (Decision.ledgerEntryId -> LedgerEntry)
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
            // Keep decision doc fields at root so we can hydrate it for variables.
            {
              $project: {
                generation: 1,
                _id: 1,
                classroomId: 1,
                challengeId: 1,
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
                profile: "$profile",
                ledger: "$ledger",
                challenge: {
                  _id: "$challenge._id",
                  title: "$challenge.title",
                  isPublished: "$challenge.isPublished",
                  isClosed: "$challenge.isClosed",
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

    const aggResult = await Decision.aggregate(pipeline);
    const data = aggResult?.[0]?.data || [];
    const total = aggResult?.[0]?.meta?.[0]?.total || 0;

    // ---- populate variables via existing helper ----
    // We hydrate each row into a Decision doc to reuse your existing population logic.
    const hydrated = data.map((row) => Decision.hydrate(row));
    await Decision.populateVariablesForMany(hydrated);

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
    console.error("Error searching decisions:", error);

    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
};