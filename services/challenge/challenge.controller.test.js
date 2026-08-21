const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const controller = require("./challenge.controller");
const Challenge = require("./challenge.model");
const Classroom = require("../classroom/classroom.model");
const Outcome = require("../outcome/outcome.model");
const LedgerEntry = require("../ledger/ledger.model");
const JobService = require("../job/lib/jobService");
const AutomationTask = require("../ai/automationTask.model");
const challengeAiService = require("./lib/challengeAiService");

test("challenge controller exports handlers", () => {
  assert.equal(typeof controller.getScenarios, "function");
  assert.equal(typeof controller.createScenario, "function");
  assert.equal(typeof controller.createScenarioWithAI, "function");
  assert.equal(typeof controller.publishScenario, "function");
});

test("publishScenario keeps a future full-automation challenge scheduled", async (t) => {
  const originals = {
    findOne: Challenge.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
  };
  t.after(() => {
    Challenge.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
  });

  const challenge = {
    _id: "challenge-id",
    classroomId: "classroom-id",
    title: "Scheduled challenge",
    isPublished: false,
    isClosed: false,
    publishAt: new Date(Date.now() + 60_000),
    publishMode: "SCHEDULED",
    automationMode: "FULL",
    automationStatus: "SCHEDULED",
    async publish(clerkUserId) {
      this.publishedBy = clerkUserId;
      this.isPublished = false;
      this.automationStatus = "SCHEDULED";
    },
  };
  Challenge.findOne = async () => challenge;
  Classroom.validateAdminAccess = async () => {};

  let statusCode = 200;
  let body;
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  await controller.publishScenario(
    {
      params: { challengeId: "challenge-id" },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    res
  );

  assert.equal(statusCode, 200);
  assert.equal(body.message, "Challenge scheduled successfully");
  assert.equal(body.data.isPublished, false);
  assert.equal(body.data.automationStatus, "SCHEDULED");
  assert.equal(challenge.publishedBy, "teacher-id");
});

test("publishScenario permits scheduled opening with manual result automation", async (t) => {
  const originals = {
    findOne: Challenge.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
  };
  t.after(() => {
    Challenge.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
  });

  const challenge = {
    _id: "challenge-id",
    classroomId: "classroom-id",
    isPublished: false,
    isClosed: false,
    publishAt: new Date(Date.now() + 60_000),
    publishMode: "SCHEDULED",
    automationMode: "MANUAL",
    async publish() {
      this.automationStatus = "SCHEDULED";
    },
  };
  Challenge.findOne = async () => challenge;
  Classroom.validateAdminAccess = async () => {};

  let statusCode = 200;
  let body;
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  await controller.publishScenario(
    {
      params: { challengeId: "challenge-id" },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    res
  );

  assert.equal(statusCode, 200);
  assert.equal(body.message, "Challenge scheduled successfully");
  assert.equal(challenge.automationStatus, "SCHEDULED");
});

test("createScenario derives scheduled opening for an older payload", async (t) => {
  const originalValidateAdminAccess = Classroom.validateAdminAccess;
  const originalCreateScenario = Challenge.createScenario;
  const originalTrigger = AutomationTask.trigger;
  t.after(() => {
    Classroom.validateAdminAccess = originalValidateAdminAccess;
    Challenge.createScenario = originalCreateScenario;
    AutomationTask.trigger = originalTrigger;
  });
  Classroom.validateAdminAccess = async () => {};
  let createdInput;
  Challenge.createScenario = async (_classroomId, input) => {
    createdInput = input;
    return { _id: "challenge-id", classroomId: "classroom-id" };
  };
  AutomationTask.trigger = async () => {};

  let statusCode = 200;
  let body;
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  await controller.createScenario(
    {
      body: {
        classroomId: "classroom-id",
        title: "Manual future challenge",
        publishAt: new Date(Date.now() + 60_000).toISOString(),
        automationMode: "MANUAL",
      },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    res
  );

  assert.equal(statusCode, 201);
  assert.equal(createdInput.publishMode, "SCHEDULED");
  assert.equal(createdInput.automationMode, "MANUAL");
  assert.equal(createdInput.automationStatus, "SCHEDULED");
});

test("updateScenario rejects scheduled opening without a start", async (t) => {
  const originals = {
    findOne: Challenge.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
  };
  t.after(() => {
    Challenge.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
  });
  Challenge.findOne = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    publishAt: null,
    submissionDeadlineAt: null,
    automationMode: "FULL",
    canEdit: () => true,
  });
  Classroom.validateAdminAccess = async () => {};

  let statusCode = 200;
  let body;
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  await controller.updateScenario(
    {
      params: { challengeId: "challenge-id" },
      body: {
        publishAt: null,
        publishMode: "SCHEDULED",
      },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    res
  );

  assert.equal(statusCode, 400);
  assert.match(body.error, /publishAt is required/);
});

test("updateScenario locks opening fields after publication", async (t) => {
  const originals = {
    findOne: Challenge.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
  };
  t.after(() => {
    Challenge.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
  });
  Challenge.findOne = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    isPublished: true,
    publishMode: "SCHEDULED",
    publishAt: new Date("2026-08-20T15:00:00.000Z"),
    submissionDeadlineAt: null,
    automationMode: "FULL",
    canEdit: () => true,
  });
  Classroom.validateAdminAccess = async () => {};

  let statusCode = 200;
  let body;
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  await controller.updateScenario(
    {
      params: { challengeId: "challenge-id" },
      body: { publishMode: "MANUAL", publishAt: null },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    res
  );

  assert.equal(statusCode, 400);
  assert.match(body.error, /Unpublish the challenge first/);
});

test("updateScenario derives publish mode for an older payload", async (t) => {
  const originals = {
    findOne: Challenge.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
  };
  t.after(() => {
    Challenge.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
  });
  const challenge = {
    _id: "challenge-id",
    classroomId: "classroom-id",
    isPublished: false,
    isClosed: false,
    publishMode: "MANUAL",
    publishAt: null,
    submissionDeadlineAt: new Date("2026-08-22T15:00:00.000Z"),
    automationMode: "MANUAL",
    feedbackReleaseMode: "IMMEDIATE",
    canEdit: () => true,
    save: async () => {},
    _loadVariables: async () => {},
    toObject() {
      return { ...this };
    },
  };
  Challenge.findOne = async () => challenge;
  Classroom.validateAdminAccess = async () => {};

  let statusCode = 200;
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json() {
      return this;
    },
  };

  await controller.updateScenario(
    {
      params: { challengeId: "challenge-id" },
      body: { publishAt: "2026-08-21T15:00:00.000Z" },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    res
  );

  assert.equal(statusCode, 200);
  assert.equal(challenge.publishMode, "SCHEDULED");
  assert.equal(challenge.automationStatus, "SCHEDULED");
});

test("student challenge detail returns 404 before the scheduled start", async (t) => {
  const originalGetScenarioById = Challenge.getScenarioById;
  t.after(() => {
    Challenge.getScenarioById = originalGetScenarioById;
  });
  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    isPublished: true,
    publishAt: new Date(Date.now() + 60_000),
  });

  let statusCode = 200;
  let body;
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  await controller.getScenarioByIdForStudent(
    { params: { id: "challenge-id" }, user: { _id: "student-id" } },
    res
  );

  assert.equal(statusCode, 404);
  assert.deepEqual(body, { error: "Challenge not found" });
});

test("createScenarioWithAI validates access and returns the generated challenge", async (t) => {
  const originals = {
    validateAdminAccess: Classroom.validateAdminAccess,
    createChallengeFromPrompt: challengeAiService.createChallengeFromPrompt,
    trigger: AutomationTask.trigger,
  };
  t.after(() => {
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    challengeAiService.createChallengeFromPrompt =
      originals.createChallengeFromPrompt;
    AutomationTask.trigger = originals.trigger;
  });

  const calls = [];
  Classroom.validateAdminAccess = async (...args) => {
    calls.push(["validate", ...args]);
  };
  challengeAiService.createChallengeFromPrompt = async (args) => {
    calls.push(["create", args]);
    return {
      _id: "challenge-id",
      classroomId: "classroom-id",
      title: "The Viral Rush",
    };
  };
  AutomationTask.trigger = async (...args) => {
    calls.push(["trigger", ...args]);
  };

  let statusCode = 200;
  let body;
  const req = {
    body: {
      classroomId: "classroom-id",
      prompt: "A complete challenge prompt long enough to generate.",
      timeZone: "America/Chicago",
    },
    organization: { _id: "organization-id" },
    clerkUser: { id: "clerk-user-id" },
  };
  const res = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  await controller.createScenarioWithAI(req, res);

  assert.equal(statusCode, 201);
  assert.equal(body.success, true);
  assert.equal(body.data._id, "challenge-id");
  assert.deepEqual(calls[0], [
    "validate",
    "classroom-id",
    "clerk-user-id",
    "organization-id",
  ]);
  assert.deepEqual(calls[1], [
    "create",
    {
      classroomId: "classroom-id",
      prompt: "A complete challenge prompt long enough to generate.",
      timeZone: "America/Chicago",
      organizationId: "organization-id",
      clerkUserId: "clerk-user-id",
    },
  ]);
});

test("cancelBatchAndRerunScenario closes and reconciles a recovered challenge", async (t) => {
  const originalSimulationMode = process.env.SIMULATION_MODE;
  const originals = {
    findOne: Challenge.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
    getOutcomeByScenario: Outcome.getOutcomeByScenario,
    resetJobsForScenario: JobService.resetJobsForScenario,
    deleteLedgerEntriesForScenario: LedgerEntry.deleteLedgerEntriesForScenario,
    createJobsForScenario: JobService.createJobsForScenario,
  };
  t.after(() => {
    if (originalSimulationMode === undefined) delete process.env.SIMULATION_MODE;
    else process.env.SIMULATION_MODE = originalSimulationMode;
    Challenge.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    Outcome.getOutcomeByScenario = originals.getOutcomeByScenario;
    JobService.resetJobsForScenario = originals.resetJobsForScenario;
    LedgerEntry.deleteLedgerEntriesForScenario =
      originals.deleteLedgerEntriesForScenario;
    JobService.createJobsForScenario = originals.createJobsForScenario;
  });

  process.env.SIMULATION_MODE = "direct";
  const calls = [];
  const challenge = {
    _id: "challenge-id",
    classroomId: "classroom-id",
    isClosed: false,
    automationStatus: "FAILED",
    automationError: "old failure",
    async beginResultCalculation(clerkUserId) {
      calls.push(["begin-result-calculation", clerkUserId]);
      this.isClosed = true;
      this.automationStatus = "processing";
      this.automationError = null;
    },
  };

  Challenge.findOne = async (query) => {
    assert.deepEqual(query, {
      _id: "challenge-id",
      organization: "organization-id",
    });
    return challenge;
  };
  Classroom.validateAdminAccess = async () => calls.push(["validate"]);
  Outcome.getOutcomeByScenario = async () => ({ _id: "outcome-id" });
  JobService.resetJobsForScenario = async () => calls.push(["reset"]);
  LedgerEntry.deleteLedgerEntriesForScenario = async () =>
    calls.push(["delete-ledgers"]);
  JobService.createJobsForScenario = async (...args) => {
    calls.push(["create-jobs", args[5]]);
    return [{ _id: "job-id" }];
  };

  let responseStatus = 200;
  let responseBody;
  const req = {
    params: { challengeId: "challenge-id" },
    organization: { _id: "organization-id" },
    clerkUser: { id: "clerk-user-id" },
  };
  const res = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await controller.cancelBatchAndRerunScenario(req, res);

  assert.equal(responseStatus, 200);
  assert.equal(responseBody.success, true);
  assert.equal(responseBody.data.jobsCreated, 1);
  assert.equal(responseBody.data.challenge, challenge);
  assert.equal(challenge.isClosed, true);
  assert.equal(challenge.automationStatus, "processing");
  assert.equal(challenge.automationError, null);
  assert.deepEqual(calls.at(-1), [
    "begin-result-calculation",
    "clerk-user-id",
  ]);
  assert.deepEqual(calls.find(([name]) => name === "create-jobs"), [
    "create-jobs",
    { enqueue: true },
  ]);
});
