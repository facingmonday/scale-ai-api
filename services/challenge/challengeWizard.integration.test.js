const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");
const Challenge = require("./challenge.model");
const Classroom = require("../classroom/classroom.model");
const Member = require("../members/member.model");
const Outcome = require("../outcome/outcome.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const ProfileType = require("../profileType/profileType.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const AutomationTask = require("../ai/automationTask.model");
const service = require("./lib/challengeWizardService");
const controller = require("./challengeWizard.controller");
const openai = require("../../lib/openai");
const id = () => new mongoose.Types.ObjectId();
const variable = {
  label: "How much inventory?",
  description: "Balance demand and waste.",
  dataType: "number",
  inputType: "slider",
  min: 0,
  max: 100,
  defaultValue: 50,
  required: true,
  options: [],
};
const draft = {
  challenge: {
    title: "Inventory squeeze",
    description: "A festival increases uncertain demand.",
  },
  variables: [variable],
  outcome: {
    notes: "Demand increased, with varying customer fit.",
    hiddenNotes: "Apply demand and production capacity limits.",
  },
};
const now = new Date("2026-09-15T12:00:00Z");
const response = () =>
  Object.assign(new EventEmitter(), {
    statusCode: 200,
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(body) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
  });
async function seed() {
  const classroomId = id(),
    organizationId = id(),
    memberId = id();
  const classroom = {
    _id: classroomId,
    organization: organizationId,
    ownership: memberId,
    name: "Business strategy",
    description: "Practice inventory decisions.",
    automationSettings: { timezone: "America/Chicago" },
    prompts: [{ role: "system", content: "Respect production capacity." }],
  };
  await Classroom.collection.insertOne(classroom);
  await Member.collection.insertOne({
    _id: memberId,
    clerkUserId: "teacher",
    organizationMemberships: [{ organizationId, role: "org:admin" }],
  });
  return {
    classroom,
    classroomId,
    organizationId,
    clerkUserId: "teacher",
    now,
  };
}
test.before(setupTestDb);
test.after(teardownTestDb);
test.beforeEach(clearCollections);

test("context excludes other organizations/classrooms and initialization; includes configured economics", async () => {
  const args = await seed();
  const challengeId = id(),
    profileId = id();
  const scope = {
    classroomId: args.classroomId,
    organization: args.organizationId,
  };
  await Challenge.collection.insertMany([
    {
      ...scope,
      _id: challengeId,
      week: 2,
      title: "Relevant challenge",
      description: "Public history",
    },
    { ...scope, week: 0, title: "Initialization secret" },
    {
      ...scope,
      week: 3,
      organization: id(),
      title: "Other organization secret",
    },
    { ...scope, week: 3, classroomId: id(), title: "Other classroom secret" },
  ]);
  await Outcome.collection.insertMany([
    {
      ...scope,
      challengeId,
      notes: "Relevant outcome",
      hiddenNotes: "Relevant guidance",
    },
    { ...scope, organization: id(), challengeId: id(), notes: "Secret" },
  ]);
  await VariableDefinition.collection.insertOne({
    ...scope,
    appliesTo: "challenge",
    challengeId,
    isActive: true,
    ...variable,
  });
  await ProfileType.collection.insertOne({
    ...scope,
    _id: profileId,
    label: "Kiosk",
    description: "Low capacity",
    isActive: true,
    startingBalance: 1000,
  });
  await VariableValue.collection.insertOne({
    ...scope,
    appliesTo: "profileType",
    ownerId: profileId,
    variableKey: "capacity",
    value: 40,
  });
  await MetricDefinition.collection.insertOne({
    ...scope,
    key: "profit",
    label: "Profit",
    isActive: true,
    dataType: "number",
  });
  const context = await service.buildContext(args);
  assert.equal(context.challenges.length, 1);
  assert.equal(context.challenges[0].variables[0].label, variable.label);
  assert.equal(context.challenges[0].outcome.hiddenNotes, "Relevant guidance");
  assert.equal(context.profiles[0].variables[0].value, 40);
  assert.equal(context.metrics[0].key, "profit");
  assert.doesNotMatch(JSON.stringify(context), /secret/i);
});
test("wizard suggestions work without history, return three typed cards, and reject malformed output", async (t) => {
  const args = await seed();
  let content = JSON.stringify({
    candidates: [1, 2, 3].map((n) => ({
      title: `Challenge ${n}`,
      description: "Practice planning.",
    })),
  });
  t.mock.method(openai.chat.completions, "create", async (input) => {
    const request = JSON.parse(input.messages[1].content);
    assert.equal(request.context.classroom.name, args.classroom.name);
    assert.deepEqual(request.context.challenges, []);
    return { choices: [{ message: { content } }] };
  });
  const result = await service.suggestions(args, { step: "challenge" });
  assert.equal(result.candidates.length, 3);
  content = "invalid JSON";
  await assert.rejects(service.suggestions(args, { step: "challenge" }), {
    statusCode: 502,
  });
  content = JSON.stringify({ candidates: [{ title: "One" }] });
  await assert.rejects(service.suggestions(args, { step: "challenge" }), {
    statusCode: 502,
  });
});
test("final creation makes no AI call, persists reviewed content and unapproved outcome", async (t) => {
  const args = await seed();
  const schedule = (await service.getSchedule(args)).schedule;
  t.mock.method(openai.chat.completions, "create", async () =>
    assert.fail("Final creation must not call AI"),
  );
  const result = await service.create(args, { draft, schedule });
  const saved = await Challenge.findById(result._id).lean();
  assert.equal(saved.isPublished, false);
  assert.equal(saved.publishMode, "SCHEDULED");
  assert.equal(saved.title, draft.challenge.title);
  const variables = await VariableDefinition.find({
    challengeId: saved._id,
  }).lean();
  assert.equal(variables.length, 1);
  assert.equal(variables[0].defaultValue, 50);
  const outcome = await Outcome.findOne({ challengeId: saved._id }).lean();
  assert.equal(outcome.approved, false);
  assert.equal(outcome.hiddenNotes, draft.outcome.hiddenNotes);
});
for (const publishMode of ["MANUAL", "SCHEDULED"]) {
  for (const automationMode of ["MANUAL", "FULL"]) {
    test(`wizard persists ${publishMode} opening / ${automationMode} lifecycle with optional dates`, async () => {
      const args = await seed();
      const schedule = {
        publishMode,
        automationMode,
        // A previously suggested opening must not make a manual draft scheduled.
        publishAt:
          publishMode === "MANUAL" ? "2020-01-01T08:00" : "2026-09-17T08:00",
        submissionDeadlineAt: "",
        closeSubmissionsAt: "",
        processAt: "",
        feedbackReleaseMode: "MANUAL",
      };
      const result = await service.create(args, { draft, schedule });
      const saved = await Challenge.findById(result._id).lean();
      assert.equal(saved.publishMode, publishMode);
      assert.equal(saved.automationMode, automationMode);
      assert.equal(saved.feedbackReleaseMode, "MANUAL");
      assert.equal(saved.isPublished, false);
      assert.equal(
        saved.automationStatus,
        publishMode === "MANUAL" ? "UNSCHEDULED" : "SCHEDULED",
      );
      assert.equal(
        saved.publishAt?.toISOString() ?? null,
        publishMode === "MANUAL" ? null : "2026-09-17T13:00:00.000Z",
      );
      for (const field of [
        "submissionDeadlineAt",
        "closeSubmissionsAt",
        "processAt",
        "feedbackReleaseAt",
      ])
        assert.equal(saved[field], null);
      assert.equal(
        await Outcome.countDocuments({ challengeId: result._id }),
        1,
      );
    });
  }
}
test("wizard persists feedback, late submission and missing-decision controls", async () => {
  const args = await seed();
  const schedule = (await service.getSchedule(args)).schedule;
  Object.assign(schedule, {
    feedbackReleaseMode: "DELAYED",
    feedbackReleaseAt: "2026-10-01T10:00",
    allowLateSubmissions: true,
    lateSubmissionPolicy: { penaltyPercentPerDay: 7 },
    missingSubmissionPolicy: "FORWARD_PREVIOUS",
    punishAbsentStudents: "medium",
  });
  const result = await service.create(args, { draft, schedule });
  const saved = await Challenge.findById(result._id).lean();
  assert.equal(saved.feedbackReleaseMode, "DELAYED");
  assert.equal(
    saved.feedbackReleaseAt.toISOString(),
    "2026-10-01T15:00:00.000Z",
  );
  assert.equal(saved.allowLateSubmissions, true);
  assert.equal(saved.lateSubmissionPolicy.penaltyPercentPerDay, 7);
  assert.equal(saved.missingSubmissionPolicy, "FORWARD_PREVIOUS");
  assert.equal(saved.punishAbsentStudents, "medium");
});
test("scheduled wizard opening without a date fails before writing", async () => {
  const args = await seed();
  await assert.rejects(
    service.create(args, { draft, schedule: { publishMode: "SCHEDULED" } }),
    /publishAt is required/,
  );
  assert.equal(await Challenge.countDocuments(), 0);
  assert.equal(await Outcome.countDocuments(), 0);
});
test("outcome suggestions use configured profile differences and allow optional directional guidance", async (t) => {
  const args = await seed();
  const scope = {
    classroomId: args.classroomId,
    organization: args.organizationId,
  };
  const outdoorId = id();
  await ProfileType.collection.insertMany([
    {
      ...scope,
      _id: outdoorId,
      key: "garden",
      label: "Garden kiosk",
      description: "An outdoor venue with exposed seating.",
      isActive: true,
    },
    {
      ...scope,
      key: "cafe",
      label: "Indoor cafe",
      description: "An indoor store with sheltered seating.",
      isActive: true,
    },
    { ...scope, key: "inactive", label: "Inactive venue", isActive: false },
    {
      ...scope,
      classroomId: id(),
      key: "other",
      label: "Other classroom venue",
      isActive: true,
    },
  ]);
  await VariableValue.collection.insertOne({
    ...scope,
    appliesTo: "profileType",
    ownerId: outdoorId,
    variableKey: "covered_seating",
    value: false,
  });
  const candidates = [
    {
      notes: "Rain continued throughout the afternoon.",
      hiddenNotes:
        "Rain may reduce demand at the Garden kiosk while drawing customers to the Indoor cafe.",
    },
    {
      notes: "The forecast storm passed without reaching the area.",
      hiddenNotes: "",
    },
    { notes: "Light rain cleared before stores opened.", hiddenNotes: "   " },
  ];
  t.mock.method(openai.chat.completions, "create", async (input) => {
    const instructions = input.messages[0].content;
    const request = JSON.parse(input.messages[1].content);
    assert.deepEqual(request.context.profiles.map((p) => p.label).sort(), [
      "Garden kiosk",
      "Indoor cafe",
    ]);
    const outdoor = request.context.profiles.find(
      (p) => p.label === "Garden kiosk",
    );
    assert.match(outdoor.description, /outdoor/);
    assert.deepEqual(outdoor.variables, [
      { key: "covered_seating", value: false },
    ]);
    assert.match(instructions, /OPTIONAL instructor-only directional guidance/);
    assert.match(instructions, /context\.profiles/);
    assert.match(
      instructions,
      /1–3 brief plain-language sentences, at most 60 words/,
    );
    assert.match(
      instructions,
      /Classroom settings already control calculations/,
    );
    assert.match(
      instructions,
      /Do not provide a calculation method, equations, percentages/,
    );
    assert.doesNotMatch(
      instructions,
      /80–180 words|Give a single consistent calculation method/,
    );
    return {
      choices: [{ message: { content: JSON.stringify({ candidates }) } }],
    };
  });
  const result = await service.suggestions(args, {
    step: "outcome",
    draft: {
      ...draft,
      challenge: {
        title: "Rainy afternoon",
        description: "Rain threatens afternoon foot traffic.",
      },
    },
  });
  assert.equal(result.candidates[0].hiddenNotes, candidates[0].hiddenNotes);
  assert.equal(result.candidates[1].hiddenNotes, "");
  assert.equal(result.candidates[2].hiddenNotes, "");
  assert.equal(await Challenge.countDocuments(scope), 0);
});
test("creation accepts blank or omitted hidden guidance without changing classroom calculation settings", async (t) => {
  const args = await seed();
  const original = await Classroom.findById(args.classroomId).lean();
  t.mock.method(openai.chat.completions, "create", async () =>
    assert.fail("Creating a reviewed draft must not generate guidance"),
  );
  for (const outcome of [
    { notes: draft.outcome.notes },
    { notes: draft.outcome.notes, hiddenNotes: "" },
    { notes: draft.outcome.notes, hiddenNotes: " \n " },
  ]) {
    const schedule = (await service.getSchedule(args)).schedule;
    const created = await service.create(args, {
      draft: { ...draft, outcome },
      schedule,
    });
    const saved = await Outcome.findOne({ challengeId: created._id }).lean();
    assert.equal(saved.notes, outcome.notes);
    assert.equal(saved.hiddenNotes, "");
    assert.equal(saved.approved, false);
  }
  assert.deepEqual(await Classroom.findById(args.classroomId).lean(), original);
});
test("skipping challenge variables supports outcome generation and creation while preserving classroom decisions", async (t) => {
  const args = await seed();
  const scope = {
    classroomId: args.classroomId,
    organization: args.organizationId,
  };
  await VariableDefinition.createDefinition(
    args.classroomId,
    {
      ...variable,
      label: "Standard classroom inventory decision",
      appliesTo: "decision",
    },
    args.organizationId,
    args.clerkUserId,
  );
  const existingDefinitions = await VariableDefinition.find(scope).lean();
  let generationCalls = 0;
  t.mock.method(openai.chat.completions, "create", async (input) => {
    generationCalls++;
    const request = JSON.parse(input.messages[1].content);
    assert.deepEqual(request.draft.variables, []);
    assert.equal(
      request.context.definitions[0].label,
      "Standard classroom inventory decision",
    );
    assert.match(
      input.messages[0].content,
      /Challenge-specific variables are optional/,
    );
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              candidates: [
                {
                  notes: "Rain continued throughout the afternoon.",
                  hiddenNotes: "",
                },
                { notes: "The afternoon remained dry.", hiddenNotes: "" },
                {
                  notes: "Rain cleared before stores opened.",
                  hiddenNotes: "",
                },
              ],
            }),
          },
        },
      ],
    };
  });
  const suggestions = await service.suggestions(args, {
    step: "outcome",
    draft: { challenge: draft.challenge, variables: [] },
  });
  assert.equal(await Challenge.countDocuments(scope), 0);
  const schedule = (await service.getSchedule(args)).schedule;
  const created = await service.create(args, {
    draft: {
      challenge: draft.challenge,
      variables: [],
      outcome: suggestions.candidates[0],
    },
    schedule,
  });
  assert.equal(generationCalls, 1);
  assert.equal(created.isPublished, false);
  assert.equal(
    await VariableDefinition.countDocuments({
      ...scope,
      challengeId: created._id,
    }),
    0,
  );
  assert.deepEqual(
    await VariableDefinition.find(scope).lean(),
    existingDefinitions,
  );
  const outcome = await Outcome.findOne({
    ...scope,
    challengeId: created._id,
  }).lean();
  assert.equal(outcome.notes, suggestions.candidates[0].notes);
  assert.equal(outcome.hiddenNotes, "");
});
test("validation rejects incompatible variables, slug collisions and empty outcomes before writing", async () => {
  const args = await seed(),
    schedule = (await service.getSchedule(args)).schedule;
  for (const invalid of [
    { ...draft, variables: [{ ...variable, inputType: "dropdown" }] },
    {
      ...draft,
      variables: [variable, { ...variable, label: "How much inventory!" }],
    },
    { ...draft, variables: null },
    { ...draft, outcome: { notes: "", hiddenNotes: "" } },
  ])
    await assert.rejects(service.create(args, { draft: invalid, schedule }), {
      statusCode: 400,
    });
  assert.equal(await Challenge.countDocuments(), 0);
});
test("partial variable persistence rolls back the entire generated challenge", async (t) => {
  const args = await seed(),
    schedule = (await service.getSchedule(args)).schedule;
  const original = VariableDefinition.createDefinition;
  let count = 0;
  t.mock.method(
    VariableDefinition,
    "createDefinition",
    async function (...values) {
      if (++count === 2) throw new Error("Write failed");
      return original.apply(this, values);
    },
  );
  await assert.rejects(
    service.create(args, {
      draft: {
        ...draft,
        variables: [variable, { ...variable, label: "How much safety stock?" }],
      },
      schedule,
    }),
    /Write failed/,
  );
  assert.equal(await Challenge.countDocuments(), 0);
  assert.equal(await VariableDefinition.countDocuments(), 0);
  assert.equal(await Outcome.countDocuments(), 0);
});
test("boolean switches save successfully", async () => {
  const args = await seed(),
    schedule = (await service.getSchedule(args)).schedule;
  const toggle = {
    ...variable,
    label: "Use rush replenishment?",
    dataType: "boolean",
    inputType: "switch",
    min: null,
    max: null,
    defaultValue: false,
  };
  const result = await service.create(args, {
    draft: { ...draft, variables: [toggle] },
    schedule,
  });
  assert.equal(
    (await VariableDefinition.findOne({ challengeId: result._id })).inputType,
    "switch",
  );
});
test("wizard saves reviewed near-term, immediate and past openings without refreshing the schedule", async () => {
  const args = await seed();
  const schedule = (await service.getSchedule(args)).schedule;
  for (const [publishAt, expected] of [
    ["2026-09-15T07:05", "2026-09-15T12:05:00.000Z"],
    ["2026-09-15T07:00", "2026-09-15T12:00:00.000Z"],
    ["2026-09-15T06:00", "2026-09-15T11:00:00.000Z"],
  ]) {
    const result = await service.create(args, {
      draft,
      schedule: { ...schedule, publishAt },
    });
    const saved = await Challenge.findById(result._id).lean();
    assert.equal(saved.publishAt.toISOString(), expected);
    assert.equal(
      saved.submissionDeadlineAt.toISOString(),
      new Date(`${schedule.submissionDeadlineAt}-05:00`).toISOString(),
    );
    assert.equal(saved.publishMode, "SCHEDULED");
    assert.equal(await Outcome.countDocuments({ challengeId: result._id }), 1);
  }
  assert.equal(await Challenge.countDocuments(), 3);
});
test("controllers check real classroom access before reading/generating/saving", async (t) => {
  const args = await seed();
  const request = {
    body: { classroomId: String(args.classroomId) },
    organization: { _id: args.organizationId },
    clerkUser: { id: "stranger" },
  };
  const generate = t.mock.method(openai.chat.completions, "create", async () =>
    assert.fail("No unauthorized generation"),
  );
  for (const action of ["schedule", "suggestions", "create"]) {
    const res = response();
    await controller[action](request, res);
    assert.equal(res.statusCode, 403);
  }
  const wrongOrg = response();
  await controller.schedule(
    { ...request, organization: { _id: id() } },
    wrongOrg,
  );
  assert.equal(wrongOrg.statusCode, 404);
  assert.equal(generate.mock.callCount(), 0);
});
test("controller triggers automation only after successful complete persistence", async (t) => {
  const args = await seed();
  const proposal = await service.getSchedule({ ...args, now: new Date() });
  let triggered = 0;
  let finish;
  const completed = new Promise((resolve) => {
    finish = resolve;
  });
  t.mock.method(AutomationTask, "trigger", async (_event, payload) => {
    triggered++;
    assert.equal(
      await VariableDefinition.countDocuments({
        challengeId: payload.challengeId,
      }),
      1,
    );
    assert.ok(
      await Outcome.findOne({ challengeId: payload.challengeId }).lean(),
    );
    finish();
  });
  const res = response();
  await controller.create(
    {
      body: {
        classroomId: String(args.classroomId),
        draft,
        schedule: proposal.schedule,
      },
      organization: { _id: args.organizationId },
      clerkUser: { id: "teacher" },
    },
    res,
  );
  assert.equal(res.statusCode, 201);
  await completed;
  assert.equal(triggered, 1);
});
