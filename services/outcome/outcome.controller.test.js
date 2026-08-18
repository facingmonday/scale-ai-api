const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./outcome.controller");
const Outcome = require("./outcome.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const LedgerEntry = require("../ledger/ledger.model");

test("outcome controller exports handlers", () => {
  assert.equal(typeof controller.setScenarioOutcome, "function");
});

test("student outcome stays hidden while that student's result is calculating", async (t) => {
  const originals = {
    getScenarioById: Challenge.getScenarioById,
    getOutcomeByScenario: Outcome.getOutcomeByScenario,
    getSubmission: Decision.getSubmission,
    getLedgerEntry: LedgerEntry.getLedgerEntry,
  };
  t.after(() => {
    Challenge.getScenarioById = originals.getScenarioById;
    Outcome.getOutcomeByScenario = originals.getOutcomeByScenario;
    Decision.getSubmission = originals.getSubmission;
    LedgerEntry.getLedgerEntry = originals.getLedgerEntry;
  });

  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    feedbackReleaseMode: "IMMEDIATE",
  });
  Outcome.getOutcomeByScenario = async () => ({
    toObject: () => ({ notes: "Shared outcome", hiddenNotes: "Teacher only" }),
  });
  Decision.getSubmission = async () => ({ processingStatus: "processing" });
  LedgerEntry.getLedgerEntry = async () => null;

  let body;
  await controller.getScenarioOutcome(
    {
      params: { challengeId: "challenge-id" },
      originalUrl: "/v1/student/outcomes/challenge-id/outcome",
      user: { _id: "student-id" },
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

  assert.deepEqual(body, { success: true, data: null });
});

test("immediate student outcome is visible after that student's ledger exists", async (t) => {
  const originals = {
    getScenarioById: Challenge.getScenarioById,
    getOutcomeByScenario: Outcome.getOutcomeByScenario,
    getSubmission: Decision.getSubmission,
    getLedgerEntry: LedgerEntry.getLedgerEntry,
  };
  t.after(() => {
    Challenge.getScenarioById = originals.getScenarioById;
    Outcome.getOutcomeByScenario = originals.getOutcomeByScenario;
    Decision.getSubmission = originals.getSubmission;
    LedgerEntry.getLedgerEntry = originals.getLedgerEntry;
  });

  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    feedbackReleaseMode: "IMMEDIATE",
  });
  Outcome.getOutcomeByScenario = async () => ({
    toObject: () => ({ notes: "Shared outcome", hiddenNotes: "Teacher only" }),
  });
  Decision.getSubmission = async () => ({ processingStatus: "completed" });
  LedgerEntry.getLedgerEntry = async () => ({ _id: "ledger-id" });

  let body;
  await controller.getScenarioOutcome(
    {
      params: { challengeId: "challenge-id" },
      originalUrl: "/v1/student/outcomes/challenge-id/outcome",
      user: { _id: "student-id" },
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

  assert.equal(body.success, true);
  assert.equal(body.data.notes, "Shared outcome");
  assert.equal(body.data.hiddenNotes, undefined);
});
