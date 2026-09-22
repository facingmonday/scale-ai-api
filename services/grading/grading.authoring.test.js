const test = require("node:test");
const assert = require("node:assert/strict");
const Challenge = require("../challenge/challenge.model");
const Classroom = require("../classroom/classroom.model");
const controller = require("../challenge/challenge.controller");
const ai = require("../challenge/lib/challengeAiService");
const wizard = require("../challenge/lib/challengeWizardService");
const AutomationTask = require("../ai/automationTask.model");
const { creationGrading } = require("../../lib/gradingSettings");

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("manual and AI controllers forward the already authorized classroom and optional points", async (t) => {
  const classroom = { gradingSettings: { defaultChallengePoints: 8 } };
  t.mock.method(Classroom, "validateAdminAccess", async () => classroom);
  t.mock.method(AutomationTask, "trigger", async () => {});
  t.mock.method(
    Challenge,
    "createScenario",
    async (_id, data, _org, _actor, options) => {
      assert.equal(options.classroom, classroom);
      assert.equal(
        creationGrading(data.pointsPossible, options.classroom).pointsPossible,
        2.5,
      );
      return { _id: "challenge", classroomId: "classroom" };
    },
  );
  const req = {
    body: { classroomId: "classroom", title: "Title", pointsPossible: 2.5 },
    organization: { _id: "organization" },
    clerkUser: { id: "teacher" },
  };
  let res = response();
  await controller.createScenario(req, res);
  assert.equal(res.statusCode, 201);
  t.mock.method(ai, "createChallengeFromPrompt", async (args) => {
    assert.equal(args.classroom, classroom);
    assert.equal(args.pointsPossible, 2.5);
    return { _id: "challenge", classroomId: "classroom" };
  });
  res = response();
  await controller.createScenarioWithAI(req, res);
  assert.equal(res.statusCode, 201);
});

test("wizard passes explicit points outside AI-generated content to shared persistence", async (t) => {
  const now = new Date("2026-09-16T10:00:00Z");
  const classroom = {
    gradingSettings: { defaultChallengePoints: 9 },
    automationSettings: { timezone: "UTC" },
  };
  t.mock.method(ai, "createChallengeFromSpec", async (args) => {
    assert.equal(args.pointsPossible, 3.75);
    assert.equal(args.classroom, classroom);
    return { _id: "created" };
  });
  const result = await wizard.create(
    { now, classroom },
    {
      pointsPossible: 3.75,
      draft: {
        challenge: { title: "Inventory", description: "Choose inventory." },
        variables: [
          {
            label: "Inventory units",
            description: "Units to buy",
            dataType: "number",
            inputType: "number",
            options: [],
            defaultValue: 2,
            min: 0,
            max: 10,
            required: true,
          },
        ],
        outcome: {
          notes: "Demand increased.",
          hiddenNotes: "Respect capacity.",
        },
      },
      schedule: {
        publishAt: "2026-09-17T10:00:00Z",
        submissionDeadlineAt: "2026-09-18T10:00:00Z",
        closeSubmissionsAt: "2026-09-18T10:00:00Z",
        processAt: "2026-09-18T10:00:00Z",
      },
    },
  );
  assert.equal(result._id, "created");
});

test("shared AI persistence uses teacher points, ignoring any AI-proposed grading", async (t) => {
  const classroom = { gradingSettings: { defaultChallengePoints: 9 } };
  t.mock.method(
    Challenge,
    "createScenario",
    async (_id, data, _org, _actor, options) => {
      assert.equal(
        creationGrading(data.pointsPossible, options.classroom).pointsPossible,
        9,
      );
      return { _id: "challenge" };
    },
  );
  t.mock.method(Challenge, "getScenarioById", async () => ({
    _id: "challenge",
  }));
  await ai.createChallengeFromSpec({
    classroomId: "classroom",
    classroom,
    generated: {
      title: "AI challenge",
      pointsPossible: 999,
      grading: { pointsPossible: 999 },
      schedule: { pointsPossible: 999 },
      variables: [],
    },
  });
});

test("editing existing challenge points is rejected before any write", async (t) => {
  const challenge = {
    classroomId: "classroom",
    canEdit() {
      assert.fail("Should reject frozen points first");
    },
  };
  t.mock.method(Challenge, "findOne", async () => challenge);
  t.mock.method(Classroom, "validateAdminAccess", async () => ({}));
  const res = response();
  await controller.updateScenario(
    {
      params: { challengeId: "challenge" },
      body: { pointsPossible: 10 },
      organization: { _id: "org" },
      clerkUser: { id: "teacher" },
    },
    res,
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /freeze at creation/);
});

test("student challenge and shared authentication serialization strip teacher grading metadata", async (t) => {
  const Enrollment = require("../enrollment/enrollment.model");
  const Decision = require("../decision/decision.model");
  const Outcome = require("../outcome/outcome.model");
  const Ledger = require("../ledger/ledger.model");
  t.mock.method(Challenge, "getScenarioById", async () => ({
    _id: "challenge",
    classroomId: "classroom",
    isPublished: true,
    grading: creationGrading(),
  }));
  t.mock.method(Enrollment, "isUserEnrolled", async () => true);
  t.mock.method(Decision, "getSubmission", async () => null);
  t.mock.method(Outcome, "getOutcomeByScenario", async () => null);
  t.mock.method(Ledger, "getLedgerEntry", async () => null);
  let res = response();
  await controller.getScenarioByIdForStudent(
    { params: { id: "challenge" }, user: { _id: "student" } },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.grading, undefined);
  const auth = require("../auth/auth.controller");
  const SeatPool = require("../licensing/seatPool.model");
  t.mock.method(
    Classroom,
    "getAllVariableDefinitionsForClassroom",
    async () => ({}),
  );
  t.mock.method(
    Classroom,
    "getAllMetricDefinitionsForClassroom",
    async () => [],
  );
  t.mock.method(SeatPool, "getBillingSummary", async () => ({}));
  res = response();
  await auth.me(
    {
      organization: { _id: "organization" },
      user: { getOrganizationMembership: () => ({ role: "org:member" }) },
      activeClassroom: {
        _id: "classroom",
        toObject: () => ({
          _id: "classroom",
          gradingSettings: { defaultChallengePoints: 5 },
        }),
      },
      classroomRole: "member",
    },
    res,
  );
  assert.equal(res.body.activeClassroom.gradingSettings, undefined);
  assert.ok(!res.body.routes.some((r) => r?.key === "gradebook"));
});
