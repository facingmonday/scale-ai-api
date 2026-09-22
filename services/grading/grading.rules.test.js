const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateCell, calculateTotals } = require("./grading.rules");
const {
  creationGrading,
  validatePoints,
  defaultPoints,
} = require("../../lib/gradingSettings");
const { csvCell, rowValues, header } = require("./grading.csv");
const { buildRoster, parseFilters } = require("./grading.service");

const now = new Date("2026-09-16T12:00:00Z");
const challenge = {
  _id: "challenge",
  title: "Inventory",
  week: 1,
  isPublished: true,
  submissionDeadlineAt: new Date("2026-09-16T12:00:00Z"),
  grading: creationGrading(),
};
const student = { userId: "student", joinedAt: new Date("2026-09-01") };
function cell(changes = {}) {
  return calculateCell({ challenge, student, now, ...changes });
}

for (const method of [
  "MANUAL",
  "DEFAULTS",
  "AI",
  "AI_FALLBACK",
  "FORWARDED_PREVIOUS",
]) {
  test(`${method} is graded by provenance, independently of processing and late penalties`, () => {
    const decision = {
      _id: "decision",
      generation: { method },
      processingStatus: "failed",
    };
    const result = cell({
      decision,
      challenge: {
        ...challenge,
        lateSubmissionPolicy: { penaltyPercentPerDay: 90 },
      },
    });
    assert.equal(result.effectivePoints, method === "MANUAL" ? 5 : 0);
    assert.equal(result.studentSubmittedAt, null);
    assert.equal(
      cell({ decision, now: new Date(now.getTime() - 1) }).effectivePoints,
      method === "MANUAL" ? 5 : null,
    );
  });
}

test("missing, skipped, legacy, future, undated and extended deadlines have distinct states", () => {
  assert.equal(cell().status, "MISSING");
  assert.equal(
    cell({ challenge: { ...challenge, missingSubmissionPolicy: "SKIP" } })
      .reasonCode,
    "SKIPPED",
  );
  assert.equal(cell({ decision: {} }).effectivePoints, 5);
  assert.equal(
    cell({ challenge: { ...challenge, grading: undefined } }).status,
    "UNGRADED",
  );
  assert.equal(
    cell({ challenge: { ...challenge, week: 0 } }).status,
    "UNGRADED",
  );
  for (const changed of [{ isPublished: false }, { publishAt: "2026-09-20" }]) {
    assert.equal(
      cell({
        challenge: { ...challenge, ...changed },
        decision: { generation: { method: "MANUAL" } },
      }).status,
      "UPCOMING",
    );
  }
  assert.equal(
    cell({ challenge: { ...challenge, submissionDeadlineAt: "2026-09-20" } })
      .status,
    "PENDING",
  );
  assert.equal(
    cell({
      challenge: {
        ...challenge,
        submissionDeadlineAt: null,
        closeSubmissionsAt: now,
      },
    }).effectivePoints,
    0,
  );
  assert.equal(
    cell({
      challenge: {
        ...challenge,
        submissionDeadlineAt: null,
        isLockedForStudents: true,
      },
    }).effectivePoints,
    0,
  );
  assert.equal(
    cell({ challenge: { ...challenge, submissionDeadlineAt: null } }).status,
    "PENDING",
  );
});

test("late joiners and removals are handled without excluding accepted manual work", () => {
  const late = { ...student, joinedAt: "2026-09-17" };
  assert.equal(cell({ student: late }).status, "NOT_APPLICABLE");
  assert.equal(
    cell({ student: late, decision: { generation: { method: "DEFAULTS" } } })
      .status,
    "NOT_APPLICABLE",
  );
  assert.equal(
    cell({ student: late, decision: { generation: { method: "MANUAL" } } })
      .effectivePoints,
    5,
  );
  assert.equal(
    cell({ student: { ...student, joinedAt: null } }).enrollmentDateUnknown,
    true,
  );
  assert.equal(
    cell({ student: { ...student, isRemoved: true, removedAt: "2026-09-15" } })
      .status,
    "NOT_APPLICABLE",
  );
});

test("adjustments override automatic points, exclusions retain provenance, restoration recalculates", () => {
  const decision = { generation: { method: "MANUAL" } };
  const adjusted = cell({
    decision,
    adjustment: { mode: "POINTS", points: 2.25, revision: 3 },
  });
  assert.equal(adjusted.automaticPoints, 5);
  assert.equal(adjusted.effectivePoints, 2.25);
  assert.equal(adjusted.revision, 3);
  assert.equal(
    cell({ decision, adjustment: { mode: "EXCUSED" } }).effectivePoints,
    null,
  );
  assert.equal(
    cell({ decision, adjustment: { mode: "AUTOMATIC" } }).effectivePoints,
    5,
  );
  const excluded = cell({ decision, exclusion: { excluded: true } });
  assert.equal(excluded.status, "EXCLUDED");
  assert.equal(excluded.automaticPoints, 5);
  assert.equal(excluded.includedInTotal, false);
  assert.equal(
    cell({
      student: { ...student, joinedAt: "2026-09-17" },
      adjustment: { mode: "POINTS", points: 3 },
    }).effectivePoints,
    3,
  );
});

test("totals count early completion, zero and decimal points without counting pending/excused work", () => {
  const manual = { generation: { method: "MANUAL" } };
  const cells = [
    cell({ decision: manual }),
    cell(),
    cell({ adjustment: { mode: "EXCUSED" } }),
    cell({ now: new Date("2026-09-15") }),
  ];
  assert.deepEqual(calculateTotals(cells), {
    earnedPoints: 5,
    possiblePoints: 10,
    percentage: 50,
  });
  const decimal = (points) =>
    cell({
      challenge: { ...challenge, grading: creationGrading(points) },
      decision: manual,
    });
  assert.deepEqual(calculateTotals([decimal(0.1), decimal(0.2)]), {
    earnedPoints: 0.3,
    possiblePoints: 0.3,
    percentage: 100,
  });
  assert.deepEqual(calculateTotals([decimal(0)]), {
    earnedPoints: 0,
    possiblePoints: 0,
    percentage: null,
  });
});

test("point defaults snapshot at creation; invalid values never reach storage", () => {
  const classroom = { gradingSettings: { defaultChallengePoints: 7.5 } };
  const grading = creationGrading(undefined, classroom, now);
  classroom.gradingSettings.defaultChallengePoints = 10;
  assert.equal(grading.pointsPossible, 7.5);
  assert.equal(creationGrading(undefined, classroom).pointsPossible, 10);
  assert.equal(creationGrading(0, classroom).pointsPossible, 0);
  assert.equal(defaultPoints({}), 5);
  for (const value of [-1, NaN, Infinity, "5", null, 1.001, Number.MAX_VALUE])
    assert.throws(() => validatePoints(value));
});

test("roster deduplicates restored enrollment, keeps earliest join and searches student numbers", () => {
  const userId = { _id: "student", firstName: "Ada", lastName: "Lovelace" };
  const roster = buildRoster(
    [
      {
        userId,
        joinedAt: "2026-09-01",
        isRemoved: true,
        removedAt: "2026-09-10",
        studentId: "001",
      },
      { userId, joinedAt: "2026-09-15", isRemoved: false, studentId: "002" },
    ],
    { includeRemoved: false, search: "002" },
  );
  assert.equal(roster.length, 1);
  assert.equal(roster[0].joinedAt, "2026-09-01");
  assert.equal(roster[0].isRemoved, false);
  assert.throws(() => parseFilters({ includeRemoved: "maybe" }));
  assert.throws(() => parseFilters({ challengeIds: ["bad"] }));
  assert.throws(() => parseFilters({ limit: 1000 }));
});

test("CSV preserves zero/status distinctions and neutralizes formula content including headers", () => {
  for (const value of ["=SUM(A1)", " +42", "@evil", "\tfield", "－12"])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('Ada, "A"\nB'), '"Ada, ""A""\nB"');
  assert.equal(csvCell("00123"), '"00123"');
  const row = {
    ...student,
    firstName: "Ada",
    lastName: "",
    studentNumber: "001",
    cells: [cell(), cell({ now: new Date("2026-09-15") })],
    totals: { earnedPoints: 0, possiblePoints: 5, percentage: 0 },
  };
  const columns = [
    { id: "a", title: "=Title", pointsPossible: 5 },
    { id: "b", title: "Same", pointsPossible: 5 },
  ];
  const wide = rowValues(row, "gradebook", columns, now.toISOString())[0];
  assert.equal(wide[5], 0);
  assert.equal(wide[6], "PENDING");
  assert.ok(csvCell(header("gradebook", columns)[5]).startsWith("\"'"));
  const detailed = rowValues(row, "detailed", columns, now.toISOString());
  assert.equal(detailed[0][9], 0);
  assert.equal(detailed[1][9], null);
});
