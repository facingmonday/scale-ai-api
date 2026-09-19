// Pure authoring helpers only. Never load gradebook services in submission or
// simulation paths, and never manufacture grading metadata for old documents.
const DEFAULT_POINTS = 5;

function validPoints(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isSafeInteger(Math.round(value * 100)) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
  );
}

function validatePoints(value, label = "pointsPossible") {
  if (!validPoints(value)) {
    throw Object.assign(
      new Error(
        `${label} must be a nonnegative number with at most two decimal places.`,
      ),
      { statusCode: 400 },
    );
  }
  return value;
}

function defaultPoints(classroom) {
  const value = classroom?.gradingSettings?.defaultChallengePoints;
  return validPoints(value) ? value : DEFAULT_POINTS;
}

function creationGrading(pointsPossible, classroom, now = new Date()) {
  return {
    pointsPossible: validatePoints(
      pointsPossible === undefined ? defaultPoints(classroom) : pointsPossible,
    ),
    method: "COMPLETION",
    policyVersion: 1,
    includedAt: now,
  };
}

// Operational rollback only: this never changes challenge creation or grades.
function gradebookAvailable() {
  return !["false", "0", "off"].includes(
    String(process.env.GRADEBOOK_ENABLED ?? "true").toLowerCase(),
  );
}

module.exports = {
  DEFAULT_POINTS,
  validPoints,
  validatePoints,
  defaultPoints,
  creationGrading,
  gradebookAvailable,
};
