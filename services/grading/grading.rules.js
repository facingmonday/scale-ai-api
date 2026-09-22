const { validPoints } = require("../../lib/gradingSettings");

function timestamp(value) {
  if (!value) return null;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

function calculateCell({
  challenge,
  student,
  decision,
  adjustment,
  exclusion,
  now,
}) {
  const grading = challenge.grading;
  const pointsPossible = validPoints(grading?.pointsPossible)
    ? grading.pointsPossible
    : null;
  const method =
    decision?.generation?.method || (decision ? "LEGACY_MANUAL" : null);
  const manual = method === "MANUAL" || method === "LEGACY_MANUAL";
  const due =
    timestamp(challenge.submissionDeadlineAt) ??
    timestamp(challenge.closeSubmissionsAt);
  const joined = timestamp(student.joinedAt);
  const removed = student.isRemoved ? timestamp(student.removedAt) : null;
  const at = now.getTime();
  const evaluationAt = removed === null ? at : Math.min(at, removed);
  const publishAt = timestamp(challenge.publishAt);
  const cell = {
    challengeId: String(challenge._id),
    pointsPossible,
    automaticPoints: null,
    effectivePoints: null,
    status: "UNGRADED",
    reasonCode: "NO_GRADING_POLICY",
    generationMethod: method,
    includedInTotal: false,
    policyVersion: grading?.policyVersion ?? null,
    decisionId: decision?._id ? String(decision._id) : null,
    // submittedAt may describe an automated record before a later student edit.
    studentSubmittedAt: null,
    revision: adjustment?.revision || 0,
    adjustment: adjustment
      ? {
          mode: adjustment.mode,
          points: adjustment.points ?? null,
          reason: adjustment.reason,
          actor: adjustment.updatedBy,
          at: adjustment.updatedDate,
        }
      : null,
    enrollmentDateUnknown: joined === null,
  };
  if (
    pointsPossible === null ||
    grading?.method !== "COMPLETION" ||
    grading?.policyVersion !== 1 ||
    challenge.week === 0
  )
    return cell;
  if (!challenge.isPublished || (publishAt !== null && publishAt > at)) {
    return { ...cell, status: "UPCOMING", reasonCode: "NOT_OPEN" };
  }
  // Only actual students' work overrides enrollment eligibility. An automatic
  // decision's existence must never turn pre-enrollment work into required work.
  if (manual) {
    cell.automaticPoints = pointsPossible;
    cell.status = "COMPLETED";
    cell.reasonCode =
      method === "LEGACY_MANUAL"
        ? "LEGACY_STUDENT_SUBMISSION"
        : "STUDENT_SUBMISSION";
  } else if (
    (due !== null && joined !== null && due < joined) ||
    (removed !== null &&
      ((due !== null && due > removed) ||
        (publishAt !== null && publishAt > removed)))
  ) {
    cell.status = "NOT_APPLICABLE";
    cell.reasonCode = "OUTSIDE_ENROLLMENT";
  } else if (
    (due !== null && due <= evaluationAt) ||
    (due === null &&
      removed === null &&
      (challenge.isLockedForStudents || challenge.isClosed))
  ) {
    cell.automaticPoints = 0;
    cell.status = method ? "AUTOMATED" : "MISSING";
    cell.reasonCode = method
      ? "AUTOMATED_SUBMISSION"
      : challenge.missingSubmissionPolicy === "SKIP"
        ? "SKIPPED"
        : "NO_SUBMISSION";
  } else {
    cell.status = "PENDING";
    cell.reasonCode = "AWAITING_SUBMISSION";
  }
  cell.effectivePoints = cell.automaticPoints;
  if (adjustment?.mode === "POINTS") {
    cell.effectivePoints = adjustment.points;
    cell.status = "ADJUSTED";
    cell.reasonCode = "TEACHER_POINTS";
  } else if (adjustment?.mode === "EXCUSED") {
    cell.effectivePoints = null;
    cell.status = "EXCUSED";
    cell.reasonCode = "TEACHER_EXCUSED";
  }
  if (exclusion?.excluded) {
    cell.effectivePoints = null;
    cell.status = "EXCLUDED";
    cell.reasonCode = "CHALLENGE_EXCLUDED";
  }
  cell.includedInTotal = cell.effectivePoints !== null;
  return cell;
}

function calculateTotals(cells) {
  let earned = 0;
  let possible = 0;
  for (const cell of cells) {
    if (!cell.includedInTotal) continue;
    earned += Math.round(cell.effectivePoints * 100);
    possible += Math.round(cell.pointsPossible * 100);
  }
  return {
    earnedPoints: earned / 100,
    possiblePoints: possible / 100,
    percentage: possible ? Math.round((earned / possible) * 10000) / 100 : null,
  };
}

module.exports = { calculateCell, calculateTotals, timestamp };
