const test = require("node:test");
const assert = require("node:assert/strict");

const openai = require("../../../lib/openai");
const Challenge = require("../challenge.model");
const Outcome = require("../../outcome/outcome.model");
const VariableDefinition = require("../../variableDefinition/variableDefinition.model");
const challengeAiService = require("./challengeAiService");

test("getDefaultSchedule starts now and closes two days later at 11:59pm in the instructor time zone", () => {
  const now = new Date("2026-08-18T15:00:00.000Z");

  const schedule = challengeAiService.getDefaultSchedule(
    now,
    "America/Chicago",
  );

  assert.equal(schedule.publishAt.toISOString(), now.toISOString());
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

  openai.chat.completions.create = async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            title: "The Viral Rush",
            description: "Opening week demand surges after a viral post.",
            scheduleMentioned: false,
            publishAt: null,
            submissionDeadlineAt: null,
            variables: [
              {
                label: "What percentage of engaged people will order?",
                description: "Estimate how online engagement converts to demand.",
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
  });

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
    timeZone: "America/Chicago",
    organizationId: "organization-id",
    clerkUserId: "clerk-user-id",
    now: new Date("2026-08-18T15:00:00.000Z"),
  });

  assert.equal(challenge._id, "challenge-id");

  const challengeCall = calls.find(([name]) => name === "challenge");
  assert.equal(challengeCall[1], "classroom-id");
  assert.equal(challengeCall[2].title, "The Viral Rush");
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
