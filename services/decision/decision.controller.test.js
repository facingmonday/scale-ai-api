const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./decision.controller");
const Decision = require("./decision.model");
const Classroom = require("../classroom/classroom.model");
const recalculationService = require("./lib/studentResultRecalculationService");

test("decision controller exports handlers", () => {
  assert.equal(typeof controller.submitWeeklyDecisions, "function");
  assert.equal(typeof controller.getSubmissions, "function");
  assert.equal(typeof controller.recalculateStudentResult, "function");
});

test("recalculateStudentResult scopes the decision and validates classroom access", async (t) => {
  const originals = {
    findOne: Decision.findOne,
    validateAdminAccess: Classroom.validateAdminAccess,
    recalculateStudentResult: recalculationService.recalculateStudentResult,
  };
  t.after(() => {
    Decision.findOne = originals.findOne;
    Classroom.validateAdminAccess = originals.validateAdminAccess;
    recalculationService.recalculateStudentResult =
      originals.recalculateStudentResult;
  });

  const decisionId = "507f1f77bcf86cd799439011";
  const organizationId = "507f1f77bcf86cd799439012";
  const decision = {
    _id: decisionId,
    classroomId: "classroom-id",
    challengeId: "challenge-id",
    userId: "student-id",
    processingStatus: "completed",
  };
  let scopedQuery;
  let accessArgs;
  Decision.findOne = (query) => {
    scopedQuery = query;
    return { select: async () => decision };
  };
  Classroom.validateAdminAccess = async (...args) => {
    accessArgs = args;
  };
  recalculationService.recalculateStudentResult = async () => ({
    decisionId,
    jobId: "job-id",
    ledgerEntryId: "ledger-id",
    recalculationRunId: "run-id",
    status: "pending",
  });

  let statusCode = 200;
  let body;
  await controller.recalculateStudentResult(
    {
      params: { decisionId },
      organization: { _id: organizationId },
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

  assert.equal(statusCode, 202);
  assert.equal(scopedQuery._id, decisionId);
  assert.equal(scopedQuery.organization, organizationId);
  assert.deepEqual(accessArgs, ["classroom-id", "teacher-id", organizationId]);
  assert.equal(body.data.recalculationRunId, "run-id");
});
