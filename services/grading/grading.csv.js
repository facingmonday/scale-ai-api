const {
  loadContext,
  orderedRoster,
  loadRows,
  columns,
  BATCH_SIZE,
  fail,
} = require("./grading.service");

function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  // Quote/escape every cell, and neutralize formula-like user content. Numbers
  // stay numbers; never use ="student-id" to try to coerce spreadsheet types.
  if (
    typeof value === "string" &&
    (/^[\s\uFEFF]*[=+@\-＝＋＠－]/u.test(text) || /^[\t\r\n]/.test(text))
  )
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
const line = (values) => values.map(csvCell).join(",") + "\r\n";

function header(layout, challengeColumns) {
  const identity = [
    "SCALE student key",
    "Student number",
    "First name",
    "Last name",
    "Enrollment status",
  ];
  return layout === "gradebook"
    ? [
        ...identity,
        ...challengeColumns.map(
          (c) =>
            `${c.title} [${c.id}] (${c.pointsPossible ?? "ungraded"} points)`,
        ),
        "Earned points",
        "Counted possible points",
        "Current grade percent",
        "Evaluated at",
      ]
    : [
        ...identity,
        "Challenge ID",
        "Challenge",
        "Maximum points",
        "Automatic points",
        "Effective points",
        "Status",
        "Reason code",
        "Submission provenance",
        "Included in total",
        "Adjustment mode",
        "Adjustment reason",
        "Adjustment actor",
        "Adjustment time",
        "Policy version",
        "Evaluated at",
      ];
}

function rowValues(row, layout, challengeColumns, evaluatedAt) {
  const identity = [
    row.userId,
    row.studentNumber,
    row.firstName,
    row.lastName,
    row.isRemoved ? "Removed" : "Active",
  ];
  if (layout === "gradebook")
    return [
      [
        ...identity,
        ...row.cells.map((c) =>
          c.effectivePoints === null ? c.status : c.effectivePoints,
        ),
        row.totals.earnedPoints,
        row.totals.possiblePoints,
        row.totals.percentage,
        evaluatedAt,
      ],
    ];
  return row.cells.map((c, i) => [
    ...identity,
    c.challengeId,
    challengeColumns[i].title,
    c.pointsPossible,
    c.automaticPoints,
    c.effectivePoints,
    c.status,
    c.reasonCode,
    c.generationMethod,
    c.includedInTotal,
    c.adjustment?.mode,
    c.adjustment?.reason,
    c.adjustment?.actor,
    c.adjustment?.at ? new Date(c.adjustment.at).toISOString() : null,
    c.policyVersion,
    evaluatedAt,
  ]);
}

async function prepareExport(options, layout) {
  if (!["gradebook", "detailed"].includes(layout))
    throw fail("Export layout must be gradebook or detailed.");
  const context = await loadContext(options);
  const roster = await orderedRoster(context);
  const challengeColumns = columns(context);
  const evaluatedAt = context.now.toISOString();
  async function* chunks() {
    yield "\uFEFF" + line(header(layout, challengeColumns));
    for (let offset = 0; offset < roster.length; offset += BATCH_SIZE) {
      if (options.signal?.aborted) throw fail("Export cancelled.", 499);
      if (options.deadline && Date.now() > options.deadline)
        throw fail("Export timed out. Try fewer challenges.", 503);
      const rows = await loadRows(
        context,
        roster.slice(offset, offset + BATCH_SIZE),
      );
      for (const row of rows)
        yield rowValues(row, layout, challengeColumns, evaluatedAt)
          .map(line)
          .join("");
    }
  }
  return { chunks: chunks(), evaluatedAt };
}

module.exports = { prepareExport, csvCell, header, rowValues, line };
