const test = require("node:test");
const assert = require("node:assert/strict");
const { suggestSchedule, parseSchedule } = require("./challengeWizardSchedule");
const classroom = { automationSettings: { timezone: "America/Chicago" } };
const challenge = (day, extra = {}) => ({
  week: 1,
  publishAt: `${day}T08:00:00-05:00`,
  submissionDeadlineAt: `${day}T20:00:00-05:00`,
  ...extra,
});

test("empty history uses the classroom schedule and minimum 24 hours", () => {
  const now = new Date("2026-09-14T15:00:00Z");
  const result = suggestSchedule(classroom, [], now);
  assert.equal(result.schedule.publishAt, "2026-09-21T08:00");
  assert.equal(result.schedule.submissionDeadlineAt, "2026-09-25T23:59");
  assert.equal(result.timeZone, "America/Chicago");
  assert.match(result.explanation, /default weekly/);
  assert.ok(
    parseSchedule(result.schedule, classroom, now).publishAt instanceof Date,
  );
});
test("median cadence ignores duplicate opening dates and initialization", () => {
  const history = [
    challenge("2026-09-01"),
    challenge("2026-09-08"),
    challenge("2026-09-08"),
    challenge("2026-09-15"),
    challenge("2026-09-29"),
    challenge("2028-01-01", { week: 0 }),
  ];
  const result = suggestSchedule(
    classroom,
    history,
    new Date("2026-09-15T00:00:00Z"),
  );
  assert.equal(result.schedule.publishAt, "2026-10-06T08:00");
  assert.equal(result.schedule.submissionDeadlineAt, "2026-10-06T20:00");
  assert.match(result.explanation, /7-day/);
});
test("rounds irregular median cadence and skips occupied submission windows", () => {
  const history = [
    challenge("2026-09-01"),
    challenge("2026-09-04"),
    challenge("2026-09-08", {
      closeSubmissionsAt: "2026-09-20T20:00:00-05:00",
      processAt: "2026-09-21T08:00:00-05:00",
    }),
  ];
  const result = suggestSchedule(
    classroom,
    history,
    new Date("2026-09-09T00:00:00Z"),
  );
  assert.equal(result.schedule.publishAt, "2026-09-24T08:00");
  assert.match(result.explanation, /4-day/);
  assert.equal(result.schedule.closeSubmissionsAt, "2026-10-06T20:00");
});
test("weekly cadence preserves local wall clock over DST", () => {
  const history = [challenge("2026-10-19"), challenge("2026-10-26")];
  const now = new Date("2026-10-28T00:00:00Z");
  const proposal = suggestSchedule(classroom, history, now);
  assert.equal(proposal.schedule.publishAt, "2026-11-02T08:00");
  assert.equal(
    parseSchedule(proposal.schedule, classroom, now).publishAt.toISOString(),
    "2026-11-02T14:00:00.000Z",
  );
});
test("invalid/missing history falls back; settings supply dates and delays", () => {
  const c = {
    automationSettings: {
      timezone: "Asia/Tokyo",
      defaultReleaseDay: "Wednesday",
      defaultReleaseTime: "09:30",
      defaultDueDay: "Thursday",
      defaultDueTime: "18:00",
      defaultCloseDelayHours: 2,
      defaultProcessDelayHours: 3,
      defaultFeedbackReleaseMode: "DELAYED",
    },
  };
  const result = suggestSchedule(
    c,
    [{ week: 1, publishAt: "bad" }, { week: 2 }],
    new Date("2026-09-14T00:00:00Z"),
  );
  assert.equal(result.schedule.publishAt, "2026-09-16T09:30");
  assert.equal(result.schedule.closeSubmissionsAt, "2026-09-17T20:00");
  assert.equal(result.schedule.processAt, "2026-09-17T23:00");
  assert.equal(result.schedule.feedbackReleaseAt, "2026-09-18T23:00");
});
test("24-hour limit is inclusive and stale schedules need review", () => {
  const now = new Date("2026-09-14T13:00:00Z");
  const s = suggestSchedule(classroom, [], now).schedule;
  s.publishAt = "2026-09-15T08:00";
  assert.doesNotThrow(() => parseSchedule(s, classroom, now));
  assert.throws(
    () => parseSchedule(s, classroom, new Date(now.getTime() + 1)),
    { code: "WIZARD_SCHEDULE_STALE", statusCode: 409 },
  );
});
test("manual opening needs no dates and discards a suggested opening", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  for (const automationMode of ["MANUAL", "FULL"]) {
    const result = parseSchedule(
      {
        publishMode: "MANUAL",
        automationMode,
        publishAt: "2020-01-01T08:00",
      },
      classroom,
      now,
    );
    assert.equal(result.publishMode, "MANUAL");
    for (const field of [
      "publishAt",
      "submissionDeadlineAt",
      "closeSubmissionsAt",
      "processAt",
      "feedbackReleaseAt",
    ])
      assert.equal(result[field], null);
  }
});
test("scheduled opening requires its date, but allows optional lifecycle dates", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  assert.throws(
    () => parseSchedule({ publishMode: "SCHEDULED" }, classroom, now),
    /publishAt is required/,
  );
  for (const automationMode of ["MANUAL", "FULL"]) {
    const result = parseSchedule(
      {
        publishMode: "SCHEDULED",
        automationMode,
        publishAt: "2026-09-17T08:00",
      },
      classroom,
      now,
    );
    assert.equal(result.publishAt.toISOString(), "2026-09-17T13:00:00.000Z");
    assert.equal(result.processAt, null);
  }
});
test("optional lifecycle dates still validate when supplied", () => {
  const s = { publishMode: "MANUAL", automationMode: "FULL" };
  assert.throws(
    () => parseSchedule({ ...s, submissionDeadlineAt: "bad" }, classroom),
    /valid date/,
  );
  assert.throws(
    () => parseSchedule({ ...s, feedbackReleaseMode: "DELAYED" }, classroom),
    /Delayed feedback/,
  );
  assert.throws(
    () =>
      parseSchedule(
        {
          ...s,
          closeSubmissionsAt: "2026-09-20T10:00",
          processAt: "2026-09-19T10:00",
        },
        classroom,
      ),
    /order/,
  );
});
test("rejects invalid order, DST gaps, and delayed release before processing", () => {
  const now = new Date("2026-02-01T00:00:00Z");
  const s = suggestSchedule(classroom, [], now).schedule;
  assert.throws(
    () =>
      parseSchedule({ ...s, closeSubmissionsAt: s.publishAt }, classroom, now),
    /order/,
  );
  assert.throws(
    () =>
      parseSchedule({ ...s, publishAt: "2026-03-08T02:30" }, classroom, now),
    /not a valid local time/,
  );
  assert.throws(
    () =>
      parseSchedule(
        {
          ...s,
          feedbackReleaseMode: "DELAYED",
          feedbackReleaseAt: s.publishAt,
        },
        classroom,
        now,
      ),
    /at or after processing/,
  );
});

test("one dated challenge still uses configured release and due defaults", () => {
  const c = {
    automationSettings: {
      timezone: "America/Chicago",
      defaultReleaseDay: "Monday",
      defaultReleaseTime: "22:00",
    },
  };
  const result = suggestSchedule(
    c,
    [challenge("2026-09-01")],
    new Date("2026-09-02T00:00:00Z"),
  );
  assert.equal(result.schedule.publishAt, "2026-09-07T22:00");
  assert.equal(result.schedule.submissionDeadlineAt, "2026-09-11T23:59");
});
test("missing latest deadline carries earlier offsets relative to the latest opening time", () => {
  const history = [
    challenge("2026-09-01", {
      submissionDeadlineAt: "2026-09-01T10:00:00-05:00",
    }),
    challenge("2026-09-08", {
      publishAt: "2026-09-08T12:00:00-05:00",
      submissionDeadlineAt: null,
    }),
  ];
  const result = suggestSchedule(
    classroom,
    history,
    new Date("2026-09-09T00:00:00Z"),
  );
  assert.equal(result.schedule.publishAt, "2026-09-15T12:00");
  assert.equal(result.schedule.submissionDeadlineAt, "2026-09-15T14:00");
});
