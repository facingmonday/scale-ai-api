const { DateTime } = require("luxon");

const DAY = 86400000;
const DATE_FIELDS = [
  "publishAt",
  "submissionDeadlineAt",
  "closeSubmissionsAt",
  "processAt",
  "feedbackReleaseAt",
];
const fail = (message) =>
  Object.assign(new Error(message), { statusCode: 400 });
const localFormat = "yyyy-MM-dd'T'HH:mm";

function classroomZone(classroom) {
  const zone = classroom.automationSettings?.timezone || "America/Chicago";
  return DateTime.now().setZone(zone).isValid ? zone : "America/Chicago";
}
function date(value, zone) {
  if (!value) return null;
  const parsed =
    value instanceof Date
      ? DateTime.fromJSDate(value, { zone })
      : DateTime.fromISO(String(value), { zone });
  return parsed.isValid ? parsed : null;
}
function calendarDays(from, to) {
  return Math.round(to.startOf("day").diff(from.startOf("day"), "days").days);
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function weekday(value, fallback) {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return days.indexOf(value) + 1 || fallback;
}
function clock(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")
    ? value.split(":").map(Number)
    : fallback;
}
function atTime(day, time) {
  return day.set({ hour: time[0], minute: time[1], second: 0, millisecond: 0 });
}
function nextWeekday(after, day, time) {
  let result = atTime(
    after.plus({ days: (day - after.weekday + 7) % 7 }),
    time,
  );
  if (result < after) result = result.plus({ weeks: 1 });
  return result;
}
function safeDelay(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function suggestSchedule(classroom, challenges, now = new Date()) {
  const timeZone = classroomZone(classroom);
  const settings = classroom.automationSettings || {};
  const minimum = DateTime.fromMillis(now.getTime() + DAY, { zone: timeZone });
  const scheduled = challenges
    .filter((c) => c.week !== 0 && c.publishMode !== "MANUAL")
    .map((c) => ({ ...c, opening: date(c.publishAt, timeZone) }))
    .filter((c) => c.opening)
    .sort((a, b) => a.opening - b.opening);
  const distinct = [
    ...new Map(scheduled.map((c) => [c.opening.toMillis(), c])).values(),
  ].slice(-8);
  const gaps = distinct
    .slice(1)
    .map((c, i) => calendarDays(distinct[i].opening, c.opening))
    .filter((n) => n > 0);
  let after = minimum;
  for (const c of scheduled) {
    const end =
      date(c.closeSubmissionsAt, timeZone) ||
      date(c.submissionDeadlineAt, timeZone) ||
      c.opening;
    if (end >= after) after = end.plus({ minutes: 1 });
    if (c.opening >= after) after = c.opening.plus({ minutes: 1 });
  }
  let opening;
  let explanation;
  if (gaps.length) {
    const cadence = Math.max(1, Math.round(median(gaps)));
    const anchor = distinct.at(-1).opening;
    const jumps = Math.max(
      1,
      Math.floor(calendarDays(anchor, after) / cadence),
    );
    opening = anchor.plus({ days: jumps * cadence }).startOf("minute");
    while (opening < after) opening = opening.plus({ days: cadence });
    explanation = `Based on your recent ${cadence}-day opening cadence, after existing submission windows.`;
  } else {
    opening = nextWeekday(
      after,
      weekday(settings.defaultReleaseDay, 1),
      clock(settings.defaultReleaseTime, [8, 0]),
    );
    explanation =
      "Using the classroom’s default weekly schedule because there is not enough dated challenge history.";
  }
  const template = gaps.length
    ? [...scheduled].reverse().find((c) => {
        const due = date(c.submissionDeadlineAt, timeZone);
        const close = date(c.closeSubmissionsAt, timeZone) || due;
        const process = date(c.processAt, timeZone) || close;
        return due && due > c.opening && close >= due && process >= close;
      })
    : null;
  let due, close, process;
  if (template) {
    const shift = (value) => {
      const target = date(value, timeZone);
      return opening.plus({
        days: calendarDays(template.opening, target),
        minutes:
          target.hour * 60 +
          target.minute -
          (template.opening.hour * 60 + template.opening.minute),
      });
    };
    due = shift(template.submissionDeadlineAt);
    close = shift(template.closeSubmissionsAt || template.submissionDeadlineAt);
    process = shift(
      template.processAt ||
        template.closeSubmissionsAt ||
        template.submissionDeadlineAt,
    );
  } else {
    due = nextWeekday(
      opening.plus({ minutes: 1 }),
      weekday(settings.defaultDueDay, 5),
      clock(settings.defaultDueTime, [23, 59]),
    );
    close = due.plus({ hours: safeDelay(settings.defaultCloseDelayHours) });
    process = close.plus({
      hours: safeDelay(settings.defaultProcessDelayHours),
    });
  }
  const mode = ["MANUAL", "IMMEDIATE", "DELAYED"].includes(
    settings.defaultFeedbackReleaseMode,
  )
    ? settings.defaultFeedbackReleaseMode
    : "IMMEDIATE";
  return {
    timeZone,
    explanation,
    schedule: {
      publishAt: opening.toFormat(localFormat),
      submissionDeadlineAt: due.toFormat(localFormat),
      closeSubmissionsAt: close.toFormat(localFormat),
      processAt: process.toFormat(localFormat),
      feedbackReleaseAt:
        mode === "DELAYED"
          ? process.plus({ days: 1 }).toFormat(localFormat)
          : "",
      publishMode: "SCHEDULED",
      automationMode: "FULL",
      feedbackReleaseMode: mode,
      allowLateSubmissions: false,
      lateSubmissionPolicy: { penaltyPercentPerDay: 0 },
      missingSubmissionPolicy:
        settings.missingSubmissionPolicy || "USE_DEFAULTS",
      punishAbsentStudents: "none",
      simulationMode: "direct",
      simulationConcurrency: 5,
    },
  };
}

function parseSchedule(input, classroom) {
  const zone = classroomZone(classroom);
  const result = { ...input, publishMode: input.publishMode || "SCHEDULED" };
  for (const field of DATE_FIELDS) {
    // Manual opening discards a previously suggested opening, as the regular form does.
    if (field === "publishAt" && result.publishMode === "MANUAL") {
      result.publishAt = null;
      continue;
    }
    const parsed = date(input[field], zone);
    if (input[field] && !parsed)
      throw fail(`${field} must be a valid date and time`);
    // Reject nonexistent local wall times rather than silently moving a DST-gap input.
    if (
      parsed &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(input[field]) &&
      parsed.toFormat(localFormat) !== input[field]
    ) {
      throw fail(`${field} is not a valid local time in ${zone}`);
    }
    result[field] = parsed?.toJSDate() || null;
  }
  if (result.publishMode === "SCHEDULED" && !result.publishAt)
    throw fail("publishAt is required for scheduled opening");
  if (
    (result.publishAt &&
      result.submissionDeadlineAt &&
      result.submissionDeadlineAt < result.publishAt) ||
    (result.submissionDeadlineAt &&
      result.closeSubmissionsAt &&
      result.closeSubmissionsAt < result.submissionDeadlineAt) ||
    (result.closeSubmissionsAt &&
      result.processAt &&
      result.processAt < result.closeSubmissionsAt)
  ) {
    throw fail(
      "Dates must follow opening, deadline, closing, then processing order.",
    );
  }
  if (
    result.feedbackReleaseMode === "DELAYED" &&
    (!result.feedbackReleaseAt ||
      (result.processAt && result.feedbackReleaseAt < result.processAt))
  ) {
    throw fail("Delayed feedback must be scheduled at or after processing.");
  }
  if (
    result.automationMode === "MANUAL" &&
    result.feedbackReleaseMode === "DELAYED"
  )
    throw fail("Delayed feedback requires automatic processing.");
  return result;
}
module.exports = { classroomZone, suggestSchedule, parseSchedule };
