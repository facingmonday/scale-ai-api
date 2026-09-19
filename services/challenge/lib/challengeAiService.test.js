const test = require("node:test");
const assert = require("node:assert/strict");

const openai = require("../../../lib/openai");
const Challenge = require("../challenge.model");
const Outcome = require("../../outcome/outcome.model");
const VariableDefinition = require("../../variableDefinition/variableDefinition.model");
const challengeAiService = require("./challengeAiService");

test("getDefaultSchedule opens tomorrow at 8am and closes two days after creation at 11:59pm", () => {
  const now = new Date("2026-08-18T15:00:00.000Z");

  const schedule = challengeAiService.getDefaultSchedule(
    now,
    "America/Chicago",
  );

  assert.equal(schedule.publishAt.toISOString(), "2026-08-19T13:00:00.000Z");
  assert.equal(
    schedule.submissionDeadlineAt.toISOString(),
    "2026-08-21T04:59:00.000Z",
  );
  assert.equal(
    schedule.closeSubmissionsAt.toISOString(),
    schedule.submissionDeadlineAt.toISOString(),
  );
  assert.equal(
    schedule.processAt.toISOString(),
    schedule.submissionDeadlineAt.toISOString(),
  );
});

test("normalizeGeneratedSpec uses explicit generated dates when the source includes a schedule", () => {
  const generated = challengeAiService.normalizeGeneratedSpec(
    {
      title: "The Viral Rush",
      description: "Opening week goes viral.",
      scheduleMentioned: true,
      openingMentioned: true,
      publishAt: "2026-09-01T09:00:00-05:00",
      submissionDeadlineAt: "2026-09-03T23:59:00-05:00",
      variables: [],
      outcome: null,
    },
    {
      now: new Date("2026-08-18T15:00:00.000Z"),
      timeZone: "America/Chicago",
    },
  );

  assert.equal(
    generated.schedule.publishAt.toISOString(),
    "2026-09-01T14:00:00.000Z",
  );
  assert.equal(
    generated.schedule.submissionDeadlineAt.toISOString(),
    "2026-09-04T04:59:00.000Z",
  );
});

test("tomorrow morning follows the local calendar across midnight and daylight saving changes", () => {
  const cases = [
    ["2026-09-19T10:00:00Z", "America/Chicago", "2026-09-20T13:00:00.000Z"],
    ["2026-09-20T04:30:00Z", "America/Chicago", "2026-09-20T13:00:00.000Z"],
    ["2026-03-07T18:00:00Z", "America/Chicago", "2026-03-08T13:00:00.000Z"],
    ["2026-10-31T17:00:00Z", "America/Chicago", "2026-11-01T14:00:00.000Z"],
    ["2026-12-31T23:30:00Z", "UTC", "2027-01-01T08:00:00.000Z"],
    ["2026-09-19T16:00:00Z", "Asia/Tokyo", "2026-09-20T23:00:00.000Z"],
    ["2026-09-19T16:00:00Z", "invalid", "2026-09-20T08:00:00.000Z"],
  ];
  for (const [now, timeZone, expected] of cases) {
    const schedule = challengeAiService.getDefaultSchedule(
      new Date(now),
      timeZone,
    );
    assert.equal(
      schedule.publishAt.toISOString(),
      expected,
      `${now} in ${timeZone}`,
    );
    assert.ok(schedule.submissionDeadlineAt > schedule.publishAt);
  }
});

test("missing opening instructions override invented dates even when a deadline is supplied", () => {
  const options = {
    now: new Date("2026-09-19T15:00:00Z"),
    timeZone: "America/Chicago",
  };
  for (const publishAt of [null, "2026-10-01T09:00:00-05:00"]) {
    const result = challengeAiService.normalizeSchedule(
      {
        scheduleMentioned: true,
        openingMentioned: false,
        publishAt,
        submissionDeadlineAt: "2026-10-03T17:00:00-05:00",
      },
      options,
    );
    assert.equal(result.publishAt.toISOString(), "2026-09-20T13:00:00.000Z");
    assert.equal(
      result.submissionDeadlineAt.toISOString(),
      "2026-10-03T22:00:00.000Z",
    );
  }
  const result = challengeAiService.normalizeSchedule(
    {
      scheduleMentioned: false,
      openingMentioned: false,
      publishAt: "2027-01-01T08:00:00Z",
    },
    options,
  );
  assert.equal(result.publishAt.toISOString(), "2026-09-20T13:00:00.000Z");
});

test("past and missing suggested openings become tomorrow morning, repairing only incompatible deadlines", () => {
  const options = {
    now: new Date("2026-09-19T15:00:00Z"),
    timeZone: "America/Chicago",
  };
  for (const publishAt of [
    null,
    "2025-01-01T08:00:00-06:00",
    "2026-09-19T09:00:00-05:00",
  ]) {
    for (const submissionDeadlineAt of [
      null,
      "2025-01-03T08:00:00-06:00",
      "2026-09-23T17:00:00-05:00",
    ]) {
      const result = challengeAiService.normalizeSchedule(
        {
          scheduleMentioned: true,
          openingMentioned: true,
          publishAt,
          submissionDeadlineAt,
        },
        options,
      );
      assert.equal(result.publishAt.toISOString(), "2026-09-20T13:00:00.000Z");
      assert.equal(
        result.submissionDeadlineAt.toISOString(),
        submissionDeadlineAt?.startsWith("2026")
          ? "2026-09-23T22:00:00.000Z"
          : "2026-09-22T04:59:00.000Z",
      );
      assert.equal(result.closeSubmissionsAt, result.submissionDeadlineAt);
      assert.equal(result.processAt, result.submissionDeadlineAt);
    }
  }
});

test("explicit later-today openings are preserved and invalid explicit schedules still fail", () => {
  const options = {
    now: new Date("2026-09-19T15:00:00Z"),
    timeZone: "America/Chicago",
  };
  const spec = {
    scheduleMentioned: true,
    openingMentioned: true,
    publishAt: "2026-09-19T18:00:00-05:00",
    submissionDeadlineAt: "2026-09-20T17:00:00-05:00",
  };
  assert.equal(
    challengeAiService.normalizeSchedule(spec, options).publishAt.toISOString(),
    "2026-09-19T23:00:00.000Z",
  );
  assert.throws(
    () =>
      challengeAiService.normalizeSchedule(
        { ...spec, publishAt: "bad" },
        options,
      ),
    { statusCode: 502 },
  );
  assert.throws(
    () =>
      challengeAiService.normalizeSchedule(
        { ...spec, submissionDeadlineAt: "2026-09-19T16:00:00-05:00" },
        options,
      ),
    /deadline before the start date/,
  );
});

test("timezone selection prefers a valid classroom setting, then browser, then UTC", () => {
  assert.equal(
    challengeAiService.resolveTimeZone("America/Chicago", "Asia/Tokyo"),
    "America/Chicago",
  );
  assert.equal(
    challengeAiService.resolveTimeZone("invalid", "Asia/Tokyo"),
    "Asia/Tokyo",
  );
  assert.equal(
    challengeAiService.resolveTimeZone(undefined, "Asia/Tokyo"),
    "Asia/Tokyo",
  );
  assert.equal(challengeAiService.resolveTimeZone("invalid", "invalid"), "UTC");
});

test("an opening that becomes past while AI is generating is moved to tomorrow morning", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-09-19T12:00:00Z"),
  });
  t.mock.method(openai.chat.completions, "create", async () => {
    t.mock.timers.tick(120000);
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Rain at the market",
              description: "Rain changes customer demand.",
              scheduleMentioned: true,
              openingMentioned: true,
              publishAt: "2026-09-19T12:01:00Z",
              submissionDeadlineAt: "2026-09-22T17:00:00-05:00",
              variables: [],
              outcome: null,
            }),
          },
        },
      ],
    };
  });
  const result = await challengeAiService.generateChallengeSpec(
    "Create a challenge about rain at the market and open it in one minute.",
    { timeZone: "America/Chicago" },
  );
  assert.equal(
    result.schedule.publishAt.toISOString(),
    "2026-09-20T13:00:00.000Z",
  );
});

test("normalizeVariable repairs numeric ranges and clamps the default", () => {
  const variable = challengeAiService.normalizeVariable({
    label: "Expected conversion",
    description: "Estimate how engagement becomes demand.",
    dataType: "number",
    inputType: "knob",
    options: [],
    defaultValue: 50,
    min: 30,
    max: 0,
    required: true,
  });

  assert.deepEqual(variable, {
    label: "Expected conversion",
    description: "Estimate how engagement becomes demand.",
    dataType: "number",
    inputType: "knob",
    options: [],
    defaultValue: 30,
    min: 0,
    max: 30,
    required: true,
  });
});

test("normalizeOutcomeNotes converts generated headings and bullets into paragraphs", () => {
  const notes = challengeAiService.normalizeOutcomeNotes(`
Preconfigured (student-visible) outcome:

- The post receives 1,000 local engagements.
- Twelve percent ultimately place an order.
- Total demand finishes 35% above forecast.
- Third-party platforms charge a 25% commission.
- Supplier rush replenishment costs 15% more.
  `);

  assert.equal(
    notes,
    [
      "The post receives 1,000 local engagements. Twelve percent ultimately place an order. Total demand finishes 35% above forecast.",
      "Third-party platforms charge a 25% commission. Supplier rush replenishment costs 15% more.",
    ].join("\n\n"),
  );
});

test("normalizeOutcomeNotes preserves intentional prose paragraphs", () => {
  const notes = challengeAiService.normalizeOutcomeNotes(
    "Demand finishes above forecast. The store serves the rush.\n\nPlatform payments arrive after seven days.",
  );

  assert.equal(
    notes,
    "Demand finishes above forecast. The store serves the rush.\n\nPlatform payments arrive after seven days.",
  );
});

test("createChallengeFromPrompt persists generated variables and an outcome draft", async (t) => {
  const originals = {
    openaiCreate: openai.chat.completions.create,
    createScenario: Challenge.createScenario,
    getScenarioById: Challenge.getScenarioById,
    createDefinition: VariableDefinition.createDefinition,
    createOrUpdateOutcome: Outcome.createOrUpdateOutcome,
  };
  t.after(() => {
    openai.chat.completions.create = originals.openaiCreate;
    Challenge.createScenario = originals.createScenario;
    Challenge.getScenarioById = originals.getScenarioById;
    VariableDefinition.createDefinition = originals.createDefinition;
    Outcome.createOrUpdateOutcome = originals.createOrUpdateOutcome;
  });

  openai.chat.completions.create = async (request) => {
    assert.match(request.messages[1].content, /Time zone: America\/Chicago/);
    assert.ok(
      request.response_format.json_schema.schema.required.includes(
        "openingMentioned",
      ),
    );
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "The Viral Rush",
              description: "Opening week demand surges after a viral post.",
              scheduleMentioned: false,
              openingMentioned: false,
              publishAt: null,
              submissionDeadlineAt: null,
              variables: [
                {
                  label: "What percentage of engaged people will order?",
                  description:
                    "Estimate how online engagement converts to demand.",
                  dataType: "number",
                  inputType: "knob",
                  options: [],
                  defaultValue: 10,
                  min: 0,
                  max: 30,
                  required: true,
                },
              ],
              outcome: {
                notes: "Twelve percent place an order.",
                hiddenNotes: "",
              },
            }),
          },
        },
      ],
    };
  };

  const calls = [];
  Challenge.createScenario = async (...args) => {
    calls.push(["challenge", ...args]);
    return { _id: "challenge-id", classroomId: args[0] };
  };
  VariableDefinition.createDefinition = async (...args) => {
    calls.push(["variable", ...args]);
    return { _id: "variable-id" };
  };
  Outcome.createOrUpdateOutcome = async (...args) => {
    calls.push(["outcome", ...args]);
    return { _id: "outcome-id" };
  };
  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    title: "The Viral Rush",
  });

  const challenge = await challengeAiService.createChallengeFromPrompt({
    classroomId: "classroom-id",
    prompt:
      "Create The Viral Rush with a conversion knob and a fixed result for every student.",
    classroom: { automationSettings: { timezone: "America/Chicago" } },
    timeZone: "Asia/Tokyo",
    organizationId: "organization-id",
    clerkUserId: "clerk-user-id",
    now: new Date("2026-08-18T15:00:00.000Z"),
  });

  assert.equal(challenge._id, "challenge-id");

  const challengeCall = calls.find(([name]) => name === "challenge");
  assert.equal(challengeCall[1], "classroom-id");
  assert.equal(challengeCall[2].title, "The Viral Rush");
  assert.equal(
    challengeCall[2].publishAt.toISOString(),
    "2026-08-19T13:00:00.000Z",
  );
  assert.equal(
    challengeCall[2].submissionDeadlineAt.toISOString(),
    "2026-08-21T04:59:00.000Z",
  );
  assert.equal(challengeCall[2].automationStatus, "SCHEDULED");

  const variableCall = calls.find(([name]) => name === "variable");
  assert.equal(variableCall[2].challengeId, "challenge-id");
  assert.equal(variableCall[2].appliesTo, "challenge");
  assert.equal(variableCall[2].defaultValue, 10);

  const outcomeCall = calls.find(([name]) => name === "outcome");
  assert.equal(outcomeCall[1], "challenge-id");
  assert.equal(outcomeCall[2].notes, "Twelve percent place an order.");
  assert.equal(outcomeCall[2].approved, false);
});
