const test = require("node:test");
const assert = require("node:assert/strict");

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
    async close(clerkUserId) {
      calls.push(["close", clerkUserId]);
      this.isClosed = true;
      this.automationStatus = "processed";
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
  assert.equal(challenge.automationStatus, "processed");
  assert.equal(challenge.automationError, null);
  assert.deepEqual(calls.at(-1), ["close", "clerk-user-id"]);
  assert.deepEqual(calls.find(([name]) => name === "create-jobs"), [
    "create-jobs",
    { enqueue: true },
  ]);
});
