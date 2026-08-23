function makeJoinPolicyError(message, statusCode, code, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

/**
 * Validates join policy and entry path before roster or seat checks.
 * @param {"invite_link"|"classroom_list"} joinSource
 */
function assertJoinPolicyAllowed({
  classroom,
  organization,
  joinPolicy,
  joinSource,
}) {
  if (joinPolicy === "closed") {
    throw makeJoinPolicyError(
      "This classroom is closed to new enrollments.",
      403,
      "CLASSROOM_CLOSED",
      { classroomId: classroom._id, organizationId: organization._id },
    );
  }

  if (joinPolicy === "invite_link" && joinSource !== "invite_link") {
    throw makeJoinPolicyError(
      "This classroom requires an invite link to join.",
      403,
      "INVITE_REQUIRED",
      { classroomId: classroom._id, organizationId: organization._id },
    );
  }
}

function assertRosterAccessAllowed({ classroom, rosterSeat, joinPolicy }) {
  if (rosterSeat) {
    return;
  }

  if (classroom.allowAnonymousJoin === false) {
    throw makeJoinPolicyError(
      "This classroom is limited to imported roster students.",
      403,
      "ROSTER_ONLY",
      { classroomId: classroom._id },
    );
  }

  if (joinPolicy === "roster_only") {
    throw makeJoinPolicyError(
      "This classroom is limited to imported roster emails.",
      403,
      "ROSTER_ONLY",
      { classroomId: classroom._id },
    );
  }
}

/**
 * Teachers may manually enroll students without consuming a paid seat when
 * the classroom accepts anyone with its private link. Self-service joins must
 * still continue through the normal organization-seat/payment flow.
 */
function allowsComplimentaryManualEnrollment(classroom) {
  const joinPolicy = classroom?.joinPolicy || "invite_link";
  return (
    joinPolicy === "invite_link" && classroom?.allowAnonymousJoin !== false
  );
}

module.exports = {
  assertJoinPolicyAllowed,
  assertRosterAccessAllowed,
  allowsComplimentaryManualEnrollment,
};
