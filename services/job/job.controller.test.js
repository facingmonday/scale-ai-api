const test = require("node:test");
const assert = require("node:assert/strict");

const controller = require("./job.controller");
const EvaluationReplacement = require("./evaluationReplacement.model");
const Challenge = require("../challenge/challenge.model");
const Classroom = require("../classroom/classroom.model");
const LedgerEntry = require("../ledger/ledger.model");
const Decision = require("../decision/decision.model");
const classroomReadinessService = require("../classroom/classroomReadiness.service");
const processing = require("./lib/challengeProcessing");

test("job controller exports handlers", () => {
  assert.equal(typeof controller.getJobsByScenario, "function");
  assert.equal(typeof controller.getJobById, "function");
  assert.equal(typeof controller.rerunStudentEvaluation, "function");
  assert.equal(typeof controller.publishReplacement, "function");
  assert.equal(typeof controller.discardReplacement, "function");
  assert.equal(typeof controller.notifyReplacement, "function");
});

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
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

function replacementFixture(state = "draft") {
  return {
    _id: "replacement-id",
    challengeId: "challenge-id",
    publishedLedgerEntryId: "ledger-id",
    state,
    activeKey: "challenge-id:user-id",
    result: {
      profileId: "profile-id",
      metrics: { score: 91 },
      summary: "Replacement summary",
      studentFeedback: { status: "completed" },
      aiMetadata: { model: "test", runId: "run", generatedAt: new Date() },
      calculationContext: {},
    },
    record(action) {
      this.lastAction = action;
    },
    async save() {
      this.saved = true;
      return this;
    },
  };
}

function authorizedRequest() {
  return {
    params: { replacementId: "replacement-id" },
    organization: { _id: "organization-id" },
    clerkUser: { id: "teacher-id" },
  };
}

test("publishing a replacement updates the existing ledger without notifying", async (t) => {
  const originals = {
    replacementFindOne: EvaluationReplacement.findOne,
    challengeGet: Challenge.getScenarioById,
    validate: Classroom.validateAdminAccess,
    ledgerUpdate: LedgerEntry.findOneAndUpdate,
    notify: LedgerEntry.sendResultNotification,
  };
  t.after(() => {
    EvaluationReplacement.findOne = originals.replacementFindOne;
    Challenge.getScenarioById = originals.challengeGet;
    Classroom.validateAdminAccess = originals.validate;
    LedgerEntry.findOneAndUpdate = originals.ledgerUpdate;
    LedgerEntry.sendResultNotification = originals.notify;
  });
  const replacement = replacementFixture();
  EvaluationReplacement.findOne = async () => replacement;
  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
  });
  let authorized = false;
  Classroom.validateAdminAccess = async () => {
    authorized = true;
  };
  LedgerEntry.findOneAndUpdate = async () => ({ _id: "ledger-id" });
  let notifications = 0;
  LedgerEntry.sendResultNotification = async () => {
    notifications += 1;
  };

  const res = responseRecorder();
  await controller.publishReplacement(authorizedRequest(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(authorized, true);
  assert.equal(replacement.state, "published");
  assert.equal(replacement.activeKey, undefined);
  assert.equal(replacement.lastAction, "replacement_published");
  assert.equal(notifications, 0);
  assert.match(res.body.message, /not been notified/i);
});

test("replacement notification is a separate idempotent action", async (t) => {
  const originals = {
    replacementFindOne: EvaluationReplacement.findOne,
    challengeGet: Challenge.getScenarioById,
    validate: Classroom.validateAdminAccess,
    notify: LedgerEntry.sendResultNotification,
  };
  t.after(() => {
    EvaluationReplacement.findOne = originals.replacementFindOne;
    Challenge.getScenarioById = originals.challengeGet;
    Classroom.validateAdminAccess = originals.validate;
    LedgerEntry.sendResultNotification = originals.notify;
  });
  const replacement = replacementFixture("published");
  EvaluationReplacement.findOne = async () => replacement;
  Challenge.getScenarioById = async () => ({ classroomId: "classroom-id" });
  Classroom.validateAdminAccess = async () => {};
  let notifications = 0;
  LedgerEntry.sendResultNotification = async () => {
    notifications += 1;
  };

  const first = responseRecorder();
  await controller.notifyReplacement(authorizedRequest(), first);
  assert.equal(notifications, 1);
  assert.ok(replacement.notifiedAt);

  const second = responseRecorder();
  await controller.notifyReplacement(authorizedRequest(), second);
  assert.equal(notifications, 1);
  assert.match(second.body.message, /already notified/i);
});

test("repeated rerun requests return the active replacement without double queueing", async (t) => {
  const originals = {
    challengeGet: Challenge.getScenarioById,
    validate: Classroom.validateAdminAccess,
    decisionFind: Decision.findOne,
    ledgerFind: LedgerEntry.findOne,
    replacementFind: EvaluationReplacement.findOne,
    ready: classroomReadinessService.assertClassroomReady,
    lock: processing.withChallengeLock,
    enqueue: processing.enqueueReplacementJob,
  };
  t.after(() => {
    Challenge.getScenarioById = originals.challengeGet;
    Classroom.validateAdminAccess = originals.validate;
    Decision.findOne = originals.decisionFind;
    LedgerEntry.findOne = originals.ledgerFind;
    EvaluationReplacement.findOne = originals.replacementFind;
    classroomReadinessService.assertClassroomReady = originals.ready;
    processing.withChallengeLock = originals.lock;
    processing.enqueueReplacementJob = originals.enqueue;
  });
  const challenge = { _id: "challenge-id", classroomId: "classroom-id" };
  const decision = {
    _id: "decision-id",
    userId: "user-id",
    ledgerEntryId: "ledger-id",
    processingStatus: "completed",
  };
  const published = { _id: "ledger-id" };
  const replacement = {
    _id: "replacement-id",
    jobId: null,
    state: "processing",
  };
  Challenge.getScenarioById = async () => challenge;
  Classroom.validateAdminAccess = async () => {};
  Decision.findOne = async () => decision;
  LedgerEntry.findOne = async () => published;
  EvaluationReplacement.findOne = async () => replacement;
  classroomReadinessService.assertClassroomReady = async () => {};
  processing.withChallengeLock = async (_challengeId, action) => action();
  let queued = 0;
  processing.enqueueReplacementJob = async () => {
    queued += 1;
  };

  const request = {
    params: { challengeId: "challenge-id", decisionId: "decision-id" },
    organization: { _id: "organization-id" },
    clerkUser: { id: "teacher-id" },
  };
  const first = responseRecorder();
  const second = responseRecorder();
  await controller.rerunStudentEvaluation(request, first);
  await controller.rerunStudentEvaluation(request, second);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(queued, 0);
  assert.match(second.body.message, /already active/i);
});

test("replacement actions reject teachers without classroom access", async (t) => {
  const originals = {
    replacementFindOne: EvaluationReplacement.findOne,
    challengeGet: Challenge.getScenarioById,
    validate: Classroom.validateAdminAccess,
    ledgerUpdate: LedgerEntry.findOneAndUpdate,
  };
  t.after(() => {
    EvaluationReplacement.findOne = originals.replacementFindOne;
    Challenge.getScenarioById = originals.challengeGet;
    Classroom.validateAdminAccess = originals.validate;
    LedgerEntry.findOneAndUpdate = originals.ledgerUpdate;
  });
  EvaluationReplacement.findOne = async () => replacementFixture();
  Challenge.getScenarioById = async () => ({ classroomId: "classroom-id" });
  Classroom.validateAdminAccess = async () => {
    throw Object.assign(new Error("Insufficient permissions"), {
      statusCode: 403,
    });
  };
  let writes = 0;
  LedgerEntry.findOneAndUpdate = async () => {
    writes += 1;
  };

  const res = responseRecorder();
  await controller.publishReplacement(authorizedRequest(), res);
  assert.equal(res.statusCode, 403);
  assert.equal(writes, 0);
});
