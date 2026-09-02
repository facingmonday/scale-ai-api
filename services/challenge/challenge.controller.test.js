const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const controller = require("./challenge.controller");
const Challenge = require("./challenge.model");
const Classroom = require("../classroom/classroom.model");
const Outcome = require("../outcome/outcome.model");
const LedgerEntry = require("../ledger/ledger.model");
const JobService = require("../job/lib/jobService");
const SimulationJob = require("../job/job.model");
const Enrollment = require("../enrollment/enrollment.model");
const Decision = require("../decision/decision.model");
const AutomationTask = require("../ai/automationTask.model");
const SimulationBatch = require("../job/simulationBatch.model");
const LedgerCompletionEvent = require("../job/ledgerCompletionEvent.model");
const { queues } = require("../../lib/queues");
const challengeAiService = require("./lib/challengeAiService");
const challengeDebriefService = require("./lib/challengeDebriefService");
const challengePreviewService = require("./lib/challengePreviewService");
const classroomReadinessService = require("../classroom/classroomReadiness.service");

test("challenge controller exports handlers", () => {
  assert.equal(typeof controller.getScenarios, "function");
  assert.equal(typeof controller.createScenario, "function");
  assert.equal(typeof controller.createScenarioWithAI, "function");
  assert.equal(typeof controller.publishScenario, "function");
});

test("releaseFeedbackScenario cannot release or notify twice", async (t) => {
  const originals = {
    findOne: Challenge.findOne,
    findOneAndUpdate: Challenge.findOneAndUpdate,
    validateAdminAccess: Classroom.validateAdminAccess,
    jobExists: SimulationJob.exists,
    sendResultsNotifications: LedgerEntry.sendResultsNotifications,
  };
  t.after(() => {
    Challenge.findOne = originals.findOne;
    Challenge.findOneAndUpdate = originals.findOneAndUpdate;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    SimulationJob.exists = originals.jobExists;
    LedgerEntry.sendResultsNotifications = originals.sendResultsNotifications;
  });

  Challenge.findOne = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    automationStatus: "processed",
    isFeedbackReleased: false,
  });
  Classroom.validateAdminAccess = async () => true;
  SimulationJob.exists = async () => false;
  Challenge.findOneAndUpdate = async () => null;
  let notificationCount = 0;
  LedgerEntry.sendResultsNotifications = async () => {
    notificationCount += 1;
  };

  let statusCode = 200;
  let body;
  await controller.releaseFeedbackScenario(
    {
      params: { challengeId: "challenge-id" },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    }
  );

  assert.equal(statusCode, 400);
  assert.deepEqual(body, { error: "Feedback is already released" });
  assert.equal(notificationCount, 0);
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

test("updateScenario rejects calculation before the submissions lock", async (t) => {
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
    isClosed: false,
    publishMode: "MANUAL",
    publishAt: null,
    submissionDeadlineAt: new Date("2026-09-02T23:59:00.000Z"),
    closeSubmissionsAt: new Date("2026-09-02T23:59:00.000Z"),
    processAt: new Date("2026-09-03T00:05:00.000Z"),
    automationMode: "FULL",
    canEdit: () => true,
  });
  Classroom.validateAdminAccess = async () => {};

  let statusCode = 200;
  let body;
  await controller.updateScenario(
    {
      params: { challengeId: "challenge-id" },
      body: { processAt: "2026-09-02T06:00:00.000Z" },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    }
  );

  assert.equal(statusCode, 400);
  assert.match(body.error, /processAt must be at or after closeSubmissionsAt/);
});

test("stopCalculationAndReopenScenario requires calculation at or after lock", async () => {
  let statusCode = 200;
  let body;
  await controller.stopCalculationAndReopenScenario(
    {
      params: { challengeId: "challenge-id" },
      body: {
        closeSubmissionsAt: "2099-09-02T23:59:00.000Z",
        processAt: "2099-09-02T06:00:00.000Z",
      },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    }
  );

  assert.equal(statusCode, 400);
  assert.match(body.error, /processAt must be at or after closeSubmissionsAt/);
});

test("stopCalculationAndReopenScenario cancels artifacts and reopens the challenge", async (t) => {
  const originals = {
    findOne: Challenge.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
    jobExists: SimulationJob.exists,
    cancelJobsForScenario: JobService.cancelJobsForScenario,
    invalidateJobsForScenario: JobService.invalidateJobsForScenario,
    cancelBatch: SimulationBatch.cancelInProgressBatchForScenario,
    findBatches: SimulationBatch.find,
    deleteLedgers: LedgerEntry.deleteMany,
    findEvents: LedgerCompletionEvent.find,
    deleteEvents: LedgerCompletionEvent.deleteMany,
    updateDecisions: Decision.updateMany,
    resetDebrief: challengeDebriefService.resetChallengeDebriefForRerun,
    outcomeGetJobs: queues.outcomeProcessing.getJobs,
    batchGetJobs: queues.simulationBatch.getJobs,
    automationGetJobs: queues.automationTask.getJobs,
  };
  t.after(() => {
    Challenge.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    SimulationJob.exists = originals.jobExists;
    JobService.cancelJobsForScenario = originals.cancelJobsForScenario;
    JobService.invalidateJobsForScenario = originals.invalidateJobsForScenario;
    SimulationBatch.cancelInProgressBatchForScenario = originals.cancelBatch;
    SimulationBatch.find = originals.findBatches;
    LedgerEntry.deleteMany = originals.deleteLedgers;
    LedgerCompletionEvent.find = originals.findEvents;
    LedgerCompletionEvent.deleteMany = originals.deleteEvents;
    Decision.updateMany = originals.updateDecisions;
    challengeDebriefService.resetChallengeDebriefForRerun = originals.resetDebrief;
    queues.outcomeProcessing.getJobs = originals.outcomeGetJobs;
    queues.simulationBatch.getJobs = originals.batchGetJobs;
    queues.automationTask.getJobs = originals.automationGetJobs;
  });

  const challenge = {
    _id: "challenge-id",
    classroomId: "classroom-id",
    isPublished: true,
    isClosed: true,
    isLockedForStudents: true,
    isFeedbackReleased: false,
    automationStatus: "processing",
    async save() {},
  };
  Challenge.findOne = async () => challenge;
  Classroom.validateAdminAccess = async () => {};
  SimulationJob.exists = async () => false;
  JobService.cancelJobsForScenario = async () => ({ total: 2, removed: 1, active: 1 });
  SimulationBatch.cancelInProgressBatchForScenario = async () => ({ cancelled: true });
  SimulationBatch.find = () => ({
    select: () => ({ lean: async () => [] }),
  });
  LedgerCompletionEvent.find = () => ({
    select: () => ({ lean: async () => [] }),
  });
  queues.outcomeProcessing.getJobs = async () => [];
  queues.simulationBatch.getJobs = async () => [];
  queues.automationTask.getJobs = async () => [];
  LedgerEntry.deleteMany = async () => ({ deletedCount: 2 });
  LedgerCompletionEvent.deleteMany = async () => ({ deletedCount: 1 });
  Decision.updateMany = async () => ({ modifiedCount: 2 });
  challengeDebriefService.resetChallengeDebriefForRerun = async () => {};

  let body;
  await controller.stopCalculationAndReopenScenario(
    {
      params: { challengeId: "challenge-id" },
      body: {
        closeSubmissionsAt: "2099-09-02T23:59:00.000Z",
        processAt: "2099-09-03T00:05:00.000Z",
      },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    {
      status() {
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    }
  );

  assert.equal(body.success, true);
  assert.equal(challenge.isClosed, false);
  assert.equal(challenge.isLockedForStudents, false);
  assert.equal(challenge.automationStatus, "acceptingSubmissions");
  assert.ok(challenge.calculationCancelledAt instanceof Date);
  assert.equal(body.data.ledgerEntriesRemoved, 2);
  assert.equal(body.data.decisionsReset, 2);
  assert.equal(body.data.calculationWasActive, true);
});

test("stopCalculationAndReopenScenario resets completed results without queue cancellation", async (t) => {
  const originals = {
    findOne: Challenge.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
    jobExists: SimulationJob.exists,
    cancelJobsForScenario: JobService.cancelJobsForScenario,
    invalidateJobsForScenario: JobService.invalidateJobsForScenario,
    findEvents: LedgerCompletionEvent.find,
    deleteLedgers: LedgerEntry.deleteMany,
    deleteEvents: LedgerCompletionEvent.deleteMany,
    updateDecisions: Decision.updateMany,
    resetDebrief: challengeDebriefService.resetChallengeDebriefForRerun,
    automationGetJobs: queues.automationTask.getJobs,
  };
  t.after(() => {
    Challenge.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    SimulationJob.exists = originals.jobExists;
    JobService.cancelJobsForScenario = originals.cancelJobsForScenario;
    JobService.invalidateJobsForScenario = originals.invalidateJobsForScenario;
    LedgerCompletionEvent.find = originals.findEvents;
    LedgerEntry.deleteMany = originals.deleteLedgers;
    LedgerCompletionEvent.deleteMany = originals.deleteEvents;
    Decision.updateMany = originals.updateDecisions;
    challengeDebriefService.resetChallengeDebriefForRerun = originals.resetDebrief;
    queues.automationTask.getJobs = originals.automationGetJobs;
  });

  const challenge = {
    _id: "challenge-id",
    classroomId: "classroom-id",
    isPublished: true,
    isClosed: true,
    automationStatus: "processed",
    async save() {},
  };
  Challenge.findOne = async () => challenge;
  Classroom.validateAdminAccess = async () => {};
  SimulationJob.exists = async () => false;
  let cancelCalled = false;
  JobService.cancelJobsForScenario = async () => {
    cancelCalled = true;
  };
  JobService.invalidateJobsForScenario = async () => ({ total: 2, removed: 0, active: 0 });
  LedgerCompletionEvent.find = () => ({
    select: () => ({ lean: async () => [] }),
  });
  queues.automationTask.getJobs = async () => [];
  LedgerEntry.deleteMany = async () => ({ deletedCount: 2 });
  LedgerCompletionEvent.deleteMany = async () => ({ deletedCount: 1 });
  Decision.updateMany = async () => ({ modifiedCount: 2 });
  challengeDebriefService.resetChallengeDebriefForRerun = async () => {};

  let body;
  await controller.stopCalculationAndReopenScenario(
    {
      params: { challengeId: "challenge-id" },
      body: {
        closeSubmissionsAt: "2099-09-02T23:59:00.000Z",
        processAt: "2099-09-03T00:05:00.000Z",
      },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    {
      status() {
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    }
  );

  assert.equal(cancelCalled, false);
  assert.equal(body.success, true);
  assert.equal(body.data.calculationWasActive, false);
  assert.match(body.message, /Results reset/);
  assert.equal(challenge.isClosed, false);
  assert.equal(challenge.isLockedForStudents, false);
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

test("preview returns readiness details without creating result jobs", async (t) => {
  const originals = {
    getScenarioById: Challenge.getScenarioById,
    validateAdminAccess: Classroom.validateAdminAccess,
    createJobsForScenario: JobService.createJobsForScenario,
    assertClassroomReady: classroomReadinessService.assertClassroomReady,
  };
  t.after(() => {
    Challenge.getScenarioById = originals.getScenarioById;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    JobService.createJobsForScenario = originals.createJobsForScenario;
    classroomReadinessService.assertClassroomReady = originals.assertClassroomReady;
  });

  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
  });
  Classroom.validateAdminAccess = async () => {};
  let jobsCreated = 0;
  JobService.createJobsForScenario = async () => {
    jobsCreated += 1;
    return [];
  };
  classroomReadinessService.assertClassroomReady = async () => {
    const error = new Error("Classroom readiness checks blocked result processing");
    error.code = "CLASSROOM_READINESS_BLOCKED";
    error.statusCode = 409;
    error.readiness = { status: "blocked", blockers: 1, checks: [] };
    throw error;
  };

  let statusCode = 200;
  let body;
  await controller.previewScenario(
    {
      params: { challengeId: "challenge-id" },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
  );

  assert.equal(statusCode, 409);
  assert.equal(body.code, "CLASSROOM_READINESS_BLOCKED");
  assert.equal(body.readiness.status, "blocked");
  assert.equal(jobsCreated, 0);
});

test("preview returns an in-memory targeted response from the preview service", async (t) => {
  const originals = {
    getScenarioById: Challenge.getScenarioById,
    validateAdminAccess: Classroom.validateAdminAccess,
    assertClassroomReady: classroomReadinessService.assertClassroomReady,
    runChallengePreview: challengePreviewService.runChallengePreview,
  };
  t.after(() => {
    Challenge.getScenarioById = originals.getScenarioById;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    classroomReadinessService.assertClassroomReady = originals.assertClassroomReady;
    challengePreviewService.runChallengePreview = originals.runChallengePreview;
  });

  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
  });
  Classroom.validateAdminAccess = async () => {};
  classroomReadinessService.assertClassroomReady = async () => ({
    status: "ready",
  });
  let receivedInput = null;
  challengePreviewService.runChallengePreview = async (input) => {
    receivedInput = input;
    return {
      status: "partial",
      profileTypes: [],
      completedCases: 1,
      failedCases: 1,
    };
  };

  let statusCode = 0;
  let body;
  await controller.previewScenario(
    {
      params: { challengeId: "challenge-id" },
      body: {
        targets: [{ profileTypeId: "type-id", case: "baseline" }],
      },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
  );

  assert.equal(statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, "partial");
  assert.deepEqual(receivedInput, {
    challengeId: "challenge-id",
    organizationId: "organization-id",
    targets: [{ profileTypeId: "type-id", case: "baseline" }],
  });
});

test("preview returns 502 when every synthetic case fails", async (t) => {
  const originals = {
    getScenarioById: Challenge.getScenarioById,
    validateAdminAccess: Classroom.validateAdminAccess,
    assertClassroomReady: classroomReadinessService.assertClassroomReady,
    runChallengePreview: challengePreviewService.runChallengePreview,
  };
  t.after(() => {
    Challenge.getScenarioById = originals.getScenarioById;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    classroomReadinessService.assertClassroomReady = originals.assertClassroomReady;
    challengePreviewService.runChallengePreview = originals.runChallengePreview;
  });

  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
  });
  Classroom.validateAdminAccess = async () => {};
  classroomReadinessService.assertClassroomReady = async () => ({
    status: "ready",
  });
  challengePreviewService.runChallengePreview = async () => ({
    status: "partial",
    profileTypes: [],
    completedCases: 0,
    failedCases: 2,
  });

  let statusCode = 0;
  let body;
  await controller.previewScenario(
    {
      params: { challengeId: "challenge-id" },
      body: {},
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
  );

  assert.equal(statusCode, 502);
  assert.equal(body.success, false);
  assert.equal(body.data.status, "partial");
});

test("student challenge detail hides results and guidance before manual release", async (t) => {
  const originals = {
    getScenarioById: Challenge.getScenarioById,
    isUserEnrolled: Enrollment.isUserEnrolled,
    getSubmission: Decision.getSubmission,
    getOutcomeByScenario: Outcome.getOutcomeByScenario,
    getLedgerEntry: LedgerEntry.getLedgerEntry,
  };
  t.after(() => {
    Challenge.getScenarioById = originals.getScenarioById;
    Enrollment.isUserEnrolled = originals.isUserEnrolled;
    Decision.getSubmission = originals.getSubmission;
    Outcome.getOutcomeByScenario = originals.getOutcomeByScenario;
    LedgerEntry.getLedgerEntry = originals.getLedgerEntry;
  });

  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    organization: "organization-id",
    isPublished: true,
    isClosed: true,
    feedbackReleaseMode: "MANUAL",
    isFeedbackReleased: false,
  });
  Enrollment.isUserEnrolled = async () => true;
  Decision.getSubmission = async () => ({ processingStatus: "completed" });
  Outcome.getOutcomeByScenario = async () => ({
    notes: "public outcome",
    hiddenNotes: "teacher-only",
    toObject() {
      return { notes: this.notes, hiddenNotes: this.hiddenNotes };
    },
  });
  LedgerEntry.getLedgerEntry = async () => ({
    summary: "valid result",
    studentFeedback: {
      status: "completed",
      nextActions: [
        { title: "Hidden action", rationale: "Not released yet." },
      ],
    },
  });

  let body;
  await controller.getScenarioByIdForStudent(
    { params: { id: "challenge-id" }, user: { _id: "student-id" } },
    {
      status() {
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
  );

  assert.equal(body.data.outcome, null);
  assert.equal(body.data.ledgerEntry, null);
  assert.equal(JSON.stringify(body).includes("Hidden action"), false);
  assert.equal(JSON.stringify(body).includes("teacher-only"), false);
});

test("admin challenge detail explicitly includes the teacher debrief", async (t) => {
  const originalGetScenarioById = Challenge.getScenarioById;
  t.after(() => {
    Challenge.getScenarioById = originalGetScenarioById;
  });
  let receivedOptions;
  Challenge.getScenarioById = async (_id, _organizationId, options) => {
    receivedOptions = options;
    return { _id: "challenge-id", isClosed: false };
  };

  let body;
  await controller.getScenarioById(
    {
      params: { id: "challenge-id" },
      organization: { _id: "organization-id" },
    },
    {
      status() {
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
  );

  assert.deepEqual(receivedOptions, { includeTeacherDebrief: true });
  assert.equal(body.success, true);
});

test("manual debrief generation validates teacher access and uses the shared service", async (t) => {
  const originals = {
    findOne: Challenge.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
    generateChallengeDebrief: challengeDebriefService.generateChallengeDebrief,
  };
  t.after(() => {
    Challenge.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    challengeDebriefService.generateChallengeDebrief =
      originals.generateChallengeDebrief;
  });

  const calls = [];
  Challenge.findOne = () => ({
    select: async () => ({ classroomId: "classroom-id" }),
  });
  Classroom.validateAdminAccess = async (...args) => {
    calls.push(["validate", ...args]);
  };
  challengeDebriefService.generateChallengeDebrief = async (args) => {
    calls.push(["generate", args]);
    return {
      teacherDebrief: { status: "completed", summary: "Teacher summary" },
    };
  };

  let body;
  await controller.generateScenarioDebrief(
    {
      params: { challengeId: "challenge-id" },
      organization: { _id: "organization-id" },
      clerkUser: { id: "teacher-id" },
    },
    {
      status() {
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
  );

  assert.deepEqual(calls, [
    ["validate", "classroom-id", "teacher-id", "organization-id"],
    [
      "generate",
      {
        challengeId: "challenge-id",
        organizationId: "organization-id",
        force: true,
      },
    ],
  ]);
  assert.equal(body.data.teacherDebrief.summary, "Teacher summary");
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
    resetChallengeDebriefForRerun:
      challengeDebriefService.resetChallengeDebriefForRerun,
    assertClassroomReady: classroomReadinessService.assertClassroomReady,
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
    challengeDebriefService.resetChallengeDebriefForRerun =
      originals.resetChallengeDebriefForRerun;
    classroomReadinessService.assertClassroomReady =
      originals.assertClassroomReady;
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
  classroomReadinessService.assertClassroomReady = async () => ({
    status: "ready",
  });
  Outcome.getOutcomeByScenario = async () => ({ _id: "outcome-id" });
  JobService.resetJobsForScenario = async () => calls.push(["reset"]);
  LedgerEntry.deleteLedgerEntriesForScenario = async () =>
    calls.push(["delete-ledgers"]);
  JobService.createJobsForScenario = async (...args) => {
    calls.push(["create-jobs", args[5]]);
    return [{ _id: "job-id" }];
  };
  challengeDebriefService.resetChallengeDebriefForRerun = async (args) => {
    calls.push(["reset-debrief", args]);
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
  assert.deepEqual(calls.find(([name]) => name === "reset-debrief"), [
    "reset-debrief",
    { challengeId: "challenge-id", organizationId: "organization-id" },
  ]);
});
