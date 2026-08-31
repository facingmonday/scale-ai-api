const mongoose = require("mongoose");

const Classroom = require("./classroom.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const Enrollment = require("../enrollment/enrollment.model");
const LedgerEntry = require("../ledger/ledger.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");
const Outcome = require("../outcome/outcome.model");
const Profile = require("../profile/profile.model");
const ProfileType = require("../profileType/profileType.model");
const SimulationJob = require("../job/job.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");

const OPERATIONS = new Set(["preview", "process", "rerun"]);
const CASH_TOLERANCE = 0.01;

class ClassroomReadinessBlockedError extends Error {
  constructor(readiness) {
    super("Classroom readiness checks blocked result processing");
    this.name = "ClassroomReadinessBlockedError";
    this.statusCode = 409;
    this.code = "CLASSROOM_READINESS_BLOCKED";
    this.readiness = readiness;
  }
}

function asPlainMap(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === "function") return value.toObject();
  return typeof value === "object" ? value : {};
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function almostEqual(left, right) {
  return Math.abs(left - right) <= CASH_TOLERANCE;
}

function check({ key, severity, passed, title, message, action = null, details = null }) {
  return {
    key,
    severity,
    status: passed ? "pass" : "fail",
    title,
    message,
    ...(action ? { action } : {}),
    ...(details ? { details } : {}),
  };
}

function skippedCheck({ key, severity, title, message }) {
  return { key, severity, status: "skipped", title, message };
}

function summarizeChecks(checks) {
  const failed = checks.filter((item) => item.status === "fail");
  const blocked = failed.some((item) => item.severity === "blocker");
  return {
    status: blocked ? "blocked" : failed.length > 0 ? "warning" : "ready",
    blockers: failed.filter((item) => item.severity === "blocker").length,
    warnings: failed.filter((item) => item.severity === "warning").length,
    passed: checks.filter((item) => item.status === "pass").length,
  };
}

async function validateOutcome({ challenge, operation }) {
  if (!challenge) {
    return skippedCheck({
      key: "global_outcome",
      severity: "blocker",
      title: "Global outcome",
      message: "Select a challenge to validate its global outcome.",
    });
  }

  const outcome = await Outcome.getOutcomeByScenario(challenge._id);
  if (!outcome) {
    return check({
      key: "global_outcome",
      severity: "blocker",
      passed: false,
      title: "Global outcome",
      message: `A saved global outcome is required before ${operation === "preview" ? "previewing" : "processing"} results.`,
      action: {
        label: "Configure Outcome",
        href: `/challenges/${challenge._id}`,
      },
    });
  }

  // The variable population plugin starts an asynchronous post-init load.
  // Await the same cached load explicitly before validating required values.
  if (typeof outcome._loadVariables === "function") {
    await outcome._loadVariables();
  }

  const outcomeData = typeof outcome.toObject === "function"
    ? outcome.toObject({ flattenMaps: true })
    : outcome;
  const validation = await VariableDefinition.validateValues(
    challenge.classroomId,
    "outcome",
    asPlainMap(outcomeData.variables),
  );
  const valid = validation?.isValid !== false;
  return check({
    key: "global_outcome",
    severity: "blocker",
    passed: valid,
    title: "Global outcome",
    message: valid
      ? "The global outcome and its required values are configured."
      : "The global outcome is missing required or valid values.",
    action: valid
      ? null
      : { label: "Configure Outcome", href: `/challenges/${challenge._id}` },
    details: valid ? null : validation.errors || null,
  });
}

async function getChallengeParticipants(challenge) {
  if (!challenge) return { decisions: [], userIds: [] };
  const decisions = await Decision.find({
    challengeId: challenge._id,
    organization: challenge.organization,
  })
    .select("_id userId")
    .lean();
  return {
    decisions,
    userIds: decisions.map((decision) => decision.userId).filter(Boolean),
  };
}

async function validateProfiles({ classroom, challenge, userIds }) {
  if (!challenge) {
    return skippedCheck({
      key: "participant_profiles",
      severity: "blocker",
      title: "Participant profiles",
      message: "Select a challenge to validate participant profiles.",
    });
  }
  if (userIds.length === 0) {
    return check({
      key: "participant_profiles",
      severity: "blocker",
      passed: true,
      title: "Participant profiles",
      message: "There are no submitted decisions requiring profiles yet.",
    });
  }

  const profiles = await Profile.find({
    classroomId: classroom._id,
    organization: classroom.organization,
    userId: { $in: userIds },
  })
    .select("_id userId profileType")
    .lean();
  const profileTypeIds = profiles.map((profile) => profile.profileType).filter(Boolean);
  const validTypes = await ProfileType.find({
    _id: { $in: profileTypeIds },
    classroomId: classroom._id,
    organization: classroom.organization,
  })
    .select("_id")
    .lean();
  const validTypeIds = new Set(validTypes.map((item) => String(item._id)));
  const profileByUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  const invalidUsers = userIds.filter((userId) => {
    const profile = profileByUser.get(String(userId));
    return !profile || !profile.profileType || !validTypeIds.has(String(profile.profileType));
  });

  return check({
    key: "participant_profiles",
    severity: "blocker",
    passed: invalidUsers.length === 0,
    title: "Participant profiles",
    message: invalidUsers.length === 0
      ? `All ${userIds.length} submitted students have a valid profile and profile type.`
      : `${invalidUsers.length} submitted student${invalidUsers.length === 1 ? " is" : "s are"} missing a valid profile or profile type.`,
    action: invalidUsers.length === 0
      ? null
      : { label: "Review Students", href: "/students" },
    details: invalidUsers.length === 0
      ? null
      : { affectedUserIds: invalidUsers.map(String) },
  });
}

async function validateLedgers({ classroom, challenge, userIds, metricDefinitions }) {
  if (!challenge) {
    return [
      skippedCheck({
        key: "week_zero_ledgers",
        severity: "blocker",
        title: "Week 0 ledgers",
        message: "Select a challenge to validate opening ledgers.",
      }),
      skippedCheck({
        key: "ledger_continuity",
        severity: "blocker",
        title: "Ledger continuity",
        message: "Select a challenge to validate ledger continuity.",
      }),
    ];
  }
  if (userIds.length === 0) {
    return [
      check({
        key: "week_zero_ledgers",
        severity: "blocker",
        passed: true,
        title: "Week 0 ledgers",
        message: "There are no submitted students requiring Week 0 validation yet.",
      }),
      check({
        key: "ledger_continuity",
        severity: "blocker",
        passed: true,
        title: "Ledger continuity",
        message: "There are no submitted students requiring continuity validation yet.",
      }),
    ];
  }

  const hasCashBefore = metricDefinitions.some((definition) => definition.key === "cashBefore");
  const hasCashAfter = metricDefinitions.some((definition) => definition.key === "cashAfter");
  const hasNetProfit = metricDefinitions.some((definition) => definition.key === "netProfit");
  const seededNumericMetrics = metricDefinitions.filter(
    (definition) =>
      definition.dataType === "number" &&
      definition.defaultInitialValue !== null &&
      definition.defaultInitialValue !== undefined,
  );
  const profiles = await Profile.find({
    classroomId: classroom._id,
    organization: classroom.organization,
    userId: { $in: userIds },
  })
    .select("_id userId profileType")
    .populate("profileType", "startingBalance initialStartupCost")
    .lean();
  const profileByUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  const ledgers = await LedgerEntry.find({
    classroomId: classroom._id,
    organization: classroom.organization,
    userId: { $in: userIds },
    $or: [{ challengeId: null }, { challengeId: { $ne: challenge._id } }],
  })
    .select("_id userId challengeId metrics createdDate")
    .populate("challengeId", "week createdDate")
    .lean({ flattenMaps: true });

  const ledgersByUser = new Map();
  for (const ledger of ledgers) {
    const userKey = String(ledger.userId);
    if (!ledgersByUser.has(userKey)) ledgersByUser.set(userKey, []);
    ledgersByUser.get(userKey).push(ledger);
  }

  const invalidWeekZero = [];
  const brokenContinuity = [];
  const currentWeek = finiteNumber(challenge.week);

  for (const userId of userIds) {
    const userKey = String(userId);
    const userLedgers = ledgersByUser.get(userKey) || [];
    const weekZero = userLedgers.find((ledger) => !ledger.challengeId);
    const profile = profileByUser.get(userKey);
    let weekZeroValid = !!weekZero;

    if (weekZeroValid) {
      const metrics = asPlainMap(weekZero.metrics);
      weekZeroValid = seededNumericMetrics.every(
        (definition) => finiteNumber(metrics[definition.key]) !== null,
      );
    }

    if (weekZeroValid && hasCashBefore && hasCashAfter && profile?.profileType) {
      const expected = LedgerEntry.calculateOpeningCash(profile.profileType);
      const metrics = asPlainMap(weekZero.metrics);
      const before = finiteNumber(metrics.cashBefore);
      const after = finiteNumber(metrics.cashAfter);
      weekZeroValid = expected !== null && before !== null && after !== null &&
        almostEqual(before, expected) && almostEqual(after, expected);
    }

    if (!weekZeroValid) {
      invalidWeekZero.push(userKey);
      continue;
    }

    if (!hasCashBefore || !hasCashAfter) continue;
    const priorLedgers = userLedgers
      .filter((ledger) => {
        if (!ledger.challengeId) return true;
        const ledgerWeek = finiteNumber(ledger.challengeId?.week);
        return currentWeek === null || ledgerWeek === null || ledgerWeek < currentWeek;
      })
      .sort((left, right) => {
        if (!left.challengeId && right.challengeId) return -1;
        if (left.challengeId && !right.challengeId) return 1;
        const leftWeek = finiteNumber(left.challengeId?.week);
        const rightWeek = finiteNumber(right.challengeId?.week);
        if (leftWeek !== null && rightWeek !== null && leftWeek !== rightWeek) {
          return leftWeek - rightWeek;
        }
        return new Date(left.createdDate || 0) - new Date(right.createdDate || 0);
      });

    let previousCashAfter = null;
    let isBroken = false;
    for (const ledger of priorLedgers) {
      const metrics = asPlainMap(ledger.metrics);
      const cashBefore = finiteNumber(metrics.cashBefore);
      const cashAfter = finiteNumber(metrics.cashAfter);
      if (cashBefore === null || cashAfter === null) {
        isBroken = true;
        break;
      }
      if (previousCashAfter !== null && !almostEqual(cashBefore, previousCashAfter)) {
        isBroken = true;
        break;
      }
      if (hasNetProfit && ledger.challengeId) {
        const netProfit = finiteNumber(metrics.netProfit);
        if (netProfit === null || !almostEqual(cashAfter, cashBefore + netProfit)) {
          isBroken = true;
          break;
        }
      }
      previousCashAfter = cashAfter;
    }
    if (isBroken) brokenContinuity.push(userKey);
  }

  return [
    check({
      key: "week_zero_ledgers",
      severity: "blocker",
      passed: invalidWeekZero.length === 0,
      title: "Week 0 ledgers",
      message: invalidWeekZero.length === 0
        ? `Week 0 is valid for all ${userIds.length} submitted students.`
        : `${invalidWeekZero.length} submitted student${invalidWeekZero.length === 1 ? " has" : "s have"} a missing or invalid Week 0 ledger.`,
      details: invalidWeekZero.length === 0
        ? null
        : { affectedUserIds: invalidWeekZero },
    }),
    check({
      key: "ledger_continuity",
      severity: "blocker",
      passed: brokenContinuity.length === 0,
      title: "Ledger continuity",
      message: brokenContinuity.length === 0
        ? "Prior ledger cash values are continuous."
        : `${brokenContinuity.length} submitted student${brokenContinuity.length === 1 ? " has" : "s have"} broken prior-ledger cash continuity.`,
      details: brokenContinuity.length === 0
        ? null
        : { affectedUserIds: brokenContinuity },
    }),
  ];
}

async function evaluateClassroomReadiness({
  classroomId,
  organizationId,
  challengeId = null,
  operation = "process",
  ignoreCheckKeys = [],
}) {
  if (!mongoose.isValidObjectId(classroomId)) {
    const error = new Error("Invalid classroomId");
    error.statusCode = 400;
    throw error;
  }
  if (!OPERATIONS.has(operation)) {
    const error = new Error("operation must be preview, process, or rerun");
    error.statusCode = 400;
    throw error;
  }

  const classroom = await Classroom.findOne({
    _id: classroomId,
    organization: organizationId,
  }).lean();
  if (!classroom) {
    const error = new Error("Class not found");
    error.statusCode = 404;
    throw error;
  }

  let challenge = null;
  if (challengeId) {
    if (!mongoose.isValidObjectId(challengeId)) {
      const error = new Error("Invalid challengeId");
      error.statusCode = 400;
      throw error;
    }
    challenge = await Challenge.findOne({
      _id: challengeId,
      classroomId: classroom._id,
      organization: organizationId,
    }).lean();
    if (!challenge) {
      const error = new Error("Challenge not found");
      error.statusCode = 404;
      throw error;
    }
  }

  const metricDefinitions = await MetricDefinition.find({
    classroomId: classroom._id,
    organization: organizationId,
    isActive: true,
  })
    .sort({ sortOrder: 1, label: 1 })
    .lean();
  const numericMetrics = metricDefinitions.filter((definition) => definition.dataType === "number");
  const leaderboard = MetricDefinition.selectLeaderboardDefinition(metricDefinitions);
  const participants = await getChallengeParticipants(challenge);

  const [outcomeCheck, profileCheck, ledgerChecks, enrollments, inProgressJobs] =
    await Promise.all([
      validateOutcome({ challenge, operation }),
      validateProfiles({ classroom, challenge, userIds: participants.userIds }),
      validateLedgers({
        classroom,
        challenge,
        userIds: participants.userIds,
        metricDefinitions,
      }),
      Enrollment.find({
        classroomId: classroom._id,
        organization: organizationId,
        role: "member",
        isRemoved: false,
      })
        .select("userId")
        .lean(),
      challenge
        ? SimulationJob.countDocuments({
          challengeId: challenge._id,
          organization: organizationId,
          status: { $in: ["pending", "running"] },
        })
        : 0,
    ]);

  const submittedUsers = new Set(participants.userIds.map(String));
  const missingSubmissions = enrollments.filter(
    (enrollment) => !submittedUsers.has(String(enrollment.userId)),
  ).length;
  const checks = [
    check({
      key: "active_numeric_metrics",
      severity: "blocker",
      passed: numericMetrics.length > 0,
      title: "Active metrics",
      message: numericMetrics.length > 0
        ? `${numericMetrics.length} active numeric metric${numericMetrics.length === 1 ? " is" : "s are"} configured.`
        : "This classroom has no active numeric metrics for simulation results.",
      action: numericMetrics.length > 0
        ? null
        : {
          label: "Configure Metrics",
          href: `/classroom/${classroom._id}?tab=definitions`,
        },
    }),
    outcomeCheck,
    profileCheck,
    ...ledgerChecks,
    check({
      key: "in_progress_jobs",
      severity: "blocker",
      passed: inProgressJobs === 0,
      title: "Result jobs",
      message: inProgressJobs === 0
        ? "No conflicting result jobs are in progress."
        : `${inProgressJobs} result job${inProgressJobs === 1 ? " is" : "s are"} still pending or running.`,
      action: inProgressJobs === 0 || !challenge
        ? null
        : { label: "View Jobs", href: `/jobs?challengeId=${challenge._id}` },
    }),
    check({
      key: "submission_completion",
      severity: "warning",
      passed: missingSubmissions === 0,
      title: "Submission completion",
      message: missingSubmissions === 0
        ? "All enrolled students have submitted."
        : `${missingSubmissions} enrolled student${missingSubmissions === 1 ? " has" : "s have"} not submitted. The configured missing-submission policy will apply.`,
      action: missingSubmissions === 0 || !challenge
        ? null
        : { label: "Review Challenge", href: `/challenges/${challenge._id}` },
    }),
    check({
      key: "leaderboard_metric",
      severity: "warning",
      passed: !!leaderboard,
      title: "Leaderboard metric",
      message: leaderboard
        ? `${leaderboard.label || leaderboard.key} is configured as the primary leaderboard metric.`
        : "No primary leaderboard metric is configured; results can process, but ranking will be unavailable.",
      action: leaderboard
        ? null
        : {
          label: "Configure Metrics",
          href: `/classroom/${classroom._id}?tab=definitions`,
        },
    }),
    challenge
      ? check({
        key: "manual_feedback_review",
        severity: "warning",
        passed: challenge.feedbackReleaseMode === "MANUAL",
        title: "Feedback review",
        message: challenge.feedbackReleaseMode === "MANUAL"
          ? "Feedback is set to Manual so results can be reviewed before release."
          : "Consider Manual feedback when previewing or replacing results so students do not see them before review.",
        action: challenge.feedbackReleaseMode === "MANUAL"
          ? null
          : { label: "Review Challenge", href: `/challenges/${challenge._id}` },
      })
      : skippedCheck({
        key: "manual_feedback_review",
        severity: "warning",
        title: "Feedback review",
        message: "Select a challenge to validate its feedback release mode.",
      }),
  ];

  const ignored = new Set(ignoreCheckKeys);
  const effectiveChecks = checks.map((item) =>
    ignored.has(item.key) && item.status === "fail"
      ? { ...item, status: "skipped", message: `${item.message} This check is handled by the requested operation.` }
      : item,
  );
  const summary = summarizeChecks(effectiveChecks);

  return {
    ...summary,
    classroomId: String(classroom._id),
    challengeId: challenge ? String(challenge._id) : null,
    operation,
    checkedAt: new Date().toISOString(),
    checks: effectiveChecks,
  };
}

async function assertClassroomReady(input) {
  const readiness = await evaluateClassroomReadiness(input);
  if (readiness.status === "blocked") {
    throw new ClassroomReadinessBlockedError(readiness);
  }
  return readiness;
}

module.exports = {
  OPERATIONS,
  ClassroomReadinessBlockedError,
  evaluateClassroomReadiness,
  assertClassroomReady,
  summarizeChecks,
};
