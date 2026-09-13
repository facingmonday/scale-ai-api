const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./challenge.controller");
const Challenge = require("./challenge.model");
const Enrollment = require("../enrollment/enrollment.model");
const Decision = require("../decision/decision.model");
const Outcome = require("../outcome/outcome.model");
const LedgerEntry = require("../ledger/ledger.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");

function setup(t, { released = false, mode = "MANUAL", processing = "completed", enrolled = true } = {}) {
  t.mock.method(Challenge, "getScenarioById", async () => ({
    _id: "challenge-id", classroomId: "classroom-id", organization: "organization-id",
    isPublished: true, isClosed: true, feedbackReleaseMode: mode, isFeedbackReleased: released,
  }));
  t.mock.method(Enrollment, "isUserEnrolled", async (classroomId, memberId) => {
    assert.equal(classroomId, "classroom-id");
    assert.equal(memberId, "signed-in-member");
    return enrolled;
  });
  t.mock.method(Decision, "getSubmission", async () => ({ processingStatus: processing }));
  t.mock.method(Outcome, "getOutcomeByScenario", async () => null);
  const lookup = t.mock.method(LedgerEntry, "getLedgerEntry", async (challengeId, memberId) => {
    assert.equal(challengeId, "challenge-id");
    assert.equal(memberId, "signed-in-member");
    return {
      _id: "ledger-id", metrics: { cashAfter: 1200 }, summary: "Results summary",
      calculationContext: { prompt: "private calculation prompt" },
      llmResponse: "private model response",
    };
  });
  t.mock.method(VariableDefinition, "find", () => ({ lean: async () => [] }));
  t.mock.method(MetricDefinition, "find", () => ({ sort: () => ({ lean: async () => [] }) }));
  return lookup;
}

async function request() {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await controller.getScenarioByIdForStudent({
    params: { id: "challenge-id" }, user: { _id: "signed-in-member" },
    query: { userId: "another-student" },
  }, res);
  return res;
}

for (const options of [{ released: true }, { mode: "IMMEDIATE" }]) {
  test(`student reads own sanitized results: ${JSON.stringify(options)}`, async (t) => {
    setup(t, options);
    const res = await request();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.ledgerEntry._id, "ledger-id");
    assert.equal(res.body.data.ledgerEntry.metrics.cashAfter, 1200);
    assert.equal(JSON.stringify(res.body).includes("private calculation prompt"), false);
    assert.equal(JSON.stringify(res.body).includes("private model response"), false);
  });
}

for (const options of [{ released: false }, { mode: "IMMEDIATE", processing: "processing" }]) {
  test(`student results stay hidden until ready: ${JSON.stringify(options)}`, async (t) => {
    setup(t, options);
    const res = await request();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.ledgerEntry, null);
  });
}

test("unenrolled student cannot read a challenge ledger", async (t) => {
  const lookup = setup(t, { enrolled: false, released: true });
  const res = await request();
  assert.equal(res.statusCode, 403);
  assert.equal(lookup.mock.callCount(), 0);
});
