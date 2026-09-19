const test = require("node:test");
const assert = require("node:assert/strict");
require("esbuild-register/dist/node").register();
const {
  calendarDay, calendarDays, calendarEvents, shiftCalendarMonth,
  matchesScheduleFilter, classroomTimezone,
} = require("../../apps/web/src/utils/challengeCalendar.ts");

test("calendar dates respect the classroom timezone across midnight and daylight saving", () => {
  assert.equal(calendarDay("2026-09-16T01:00:00Z", "America/Chicago"), "2026-09-15");
  assert.equal(calendarDay("2026-09-16T01:00:00Z", "Asia/Tokyo"), "2026-09-16");
  assert.equal(calendarDay("2026-11-01T06:30:00Z", "America/Chicago"), "2026-11-01");
  assert.equal(calendarDay("2026-11-01T07:30:00Z", "America/Chicago"), "2026-11-01");
  assert.equal(calendarDay("not-a-date", "America/Chicago"), null);
  assert.equal(classroomTimezone("not-a-zone"), "America/Chicago");
});

test("month navigation and day grids handle leap years and year boundaries", () => {
  assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01");
  assert.equal(shiftCalendarMonth("2026-01", -1), "2025-12");
  const days = calendarDays("2028-02");
  assert.equal(days.length, 42);
  assert.equal(new Set(days).size, 42);
  assert.equal(days[0], "2028-01-30");
  assert.ok(days.includes("2028-02-29"));
  assert.equal(new Date(`${days[0]}T12:00:00Z`).getUTCDay(), 0);
});

test("all event types share a date, reminders remain distinct, and links use challenge IDs", () => {
  const events = calendarEvents([{
    _id: "challenge", title: "Pricing", publishMode: "SCHEDULED", publishAt: "2026-09-15T13:00:00Z",
    submissionDeadlineAt: "2026-09-16T01:00:00Z", feedbackReleaseMode: "DELAYED", feedbackReleaseAt: "2026-09-16T02:00:00Z",
  }], [
    { _id: "first", challengeId: "challenge", sendAt: "2026-09-15T20:00:00Z" },
    { _id: "second", challengeId: "challenge", sendAt: "2026-09-16T00:00:00Z" },
    { _id: "foreign", challengeId: "other", sendAt: "2026-09-15T14:00:00Z" },
  ], "America/Chicago");
  assert.deepEqual(events.map((event) => event.kind), ["opening", "reminder", "reminder", "deadline", "results"]);
  assert.ok(events.every((event) => event.day === "2026-09-15" && event.challengeId === "challenge"));
  assert.equal(new Set(events.map((event) => event.id)).size, 5);
});

test("manual openings and unscheduled releases are not invented; invalid dates are omitted", () => {
  const events = calendarEvents([
    { _id: "manual", publishMode: "MANUAL", publishAt: "2026-09-15", feedbackReleaseMode: "MANUAL", feedbackReleaseAt: "2026-09-16", closeSubmissionsAt: "2026-09-17" },
    { id: "immediate", feedbackReleaseMode: "IMMEDIATE", feedbackReleaseAt: "2026-09-16", submissionDeadlineAt: "invalid" },
    { title: "No ID", submissionDeadlineAt: "2026-09-17" },
  ], [], "America/Chicago");
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "deadline");
  assert.equal(events[0].challengeId, "manual");
});

test("status filters distinguish locked submissions, scheduled openings, drafts and review", () => {
  assert.equal(matchesScheduleFilter({ isPublished: true }, "open"), true);
  assert.equal(matchesScheduleFilter({ isPublished: true, isLockedForStudents: true }, "open"), false);
  assert.equal(matchesScheduleFilter({ isPublished: false, publishMode: "SCHEDULED", publishAt: "2099-01-01" }, "scheduled"), true);
  assert.equal(matchesScheduleFilter({ isPublished: false }, "drafts"), true);
  assert.equal(matchesScheduleFilter({ automationStatus: "FAILED" }, "review"), true);
  assert.equal(matchesScheduleFilter({ automationStatus: "processed", isFeedbackReleased: false }, "review"), true);
  assert.equal(matchesScheduleFilter({ automationStatus: "processed", isFeedbackReleased: true }, "review"), false);
});
