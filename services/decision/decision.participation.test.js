const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Decision = require("./decision.model");
const Challenge = require("../challenge/challenge.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const LedgerEntry = require("../ledger/ledger.model");

// Exercise the real submission method and Mongoose document with only database
// operations/definition lookups replaced; these tests never connect to a database.
function submissionFixture(t, method = "DEFAULTS", failure = null) {
  const id = () => new mongoose.Types.ObjectId();
  const decision = new Decision({
    classroomId: id(), challengeId: id(), userId: id(), organization: id(),
    createdBy: "original-actor", updatedBy: "original-actor",
    challengeVariableAnswers: { shippingDays: 2 },
    generation: method === "MANUAL" ? { method } : {
      method,
      forwardedFromScenarioId: id(), forwardedFromSubmissionId: id(),
      meta: { absentPunishmentLevel: "high", note: "Automatically created" },
    },
  });
  let stored = decision.toObject();
  let values = { inventory: 50 };
  const writes = [];
  const originalGeneration = decision.toObject().generation;

  t.mock.method(Decision, "findOne", async () => decision);
  t.mock.method(Challenge, "findById", async () => ({
    isPublished: true, isClosed: false,
    isLockedForStudents: failure === "locked",
    getVariables: async () => ({ shippingDays: 2 }),
  }));
  t.mock.method(Challenge, "hasStarted", () => true);
  t.mock.method(VariableDefinition, "validateValues", async (_classroom, scope) => ({
    isValid: failure !== `invalid-${scope}`,
    errors: failure === `invalid-${scope}` ? [{ message: "Out of range" }] : [],
  }));
  t.mock.method(VariableDefinition, "applyDefaults", async (_classroom, _scope, input) => input);
  t.mock.method(VariableDefinition, "filterVariablesByActiveDefinitions", async (_classroom, _scope, input) => input);
  t.mock.method(VariableValue, "deleteMany", async () => {
    if (failure === "delete") throw new Error("Value deletion failed");
    values = {};
    writes.push("delete-values");
  });
  t.mock.method(VariableValue, "insertMany", async (docs) => {
    if (failure === "insert") throw new Error("Value insertion failed");
    values = Object.fromEntries(docs.map((doc) => [doc.variableKey, doc.value]));
    writes.push("insert-values");
  });
  t.mock.method(decision, "save", async () => {
    stored = decision.toObject();
    writes.push("save-decision");
    return decision;
  });
  t.mock.method(Decision, "populateVariablesForMany", async () => {});
  t.mock.method(decision, "_getCachedVariables", () => values);

  return {
    decision, originalGeneration, writes,
    stored: () => stored,
    submit: () => Decision.updateSubmission(
      decision.classroomId, decision.challengeId, decision.userId,
      { inventory: 72 }, decision.organization, "student-actor",
      { challengeVariableAnswers: { shippingDays: 4 } },
    ),
  };
}

for (const method of ["DEFAULTS", "FORWARDED_PREVIOUS", "AI", "AI_FALLBACK", "MANUAL"]) {
  test(`student update of ${method} becomes manual without an absence penalty`, async (t) => {
    const fixture = submissionFixture(t, method);
    const updated = await fixture.submit();

    assert.equal(updated.generation.method, "MANUAL");
    assert.equal(updated.generation.meta, null);
    assert.equal(updated.generation.forwardedFromScenarioId, null);
    assert.equal(updated.generation.forwardedFromSubmissionId, null);
    assert.deepEqual(updated.challengeVariableAnswers, { shippingDays: 4 });
    assert.deepEqual(updated.variables, { inventory: 72 });
    assert.equal(fixture.stored().generation.method, "MANUAL");
    assert.equal(fixture.stored().updatedBy, "student-actor");
    assert.equal(fixture.stored().createdBy, "original-actor");
    assert.deepEqual(fixture.writes, ["delete-values", "insert-values", "save-decision"]);

    const messages = LedgerEntry.buildAISimulationPrompt(
      [], {}, { title: "Shipping", variables: {} },
      { notes: "Shared outcome", variables: {} }, updated, [], {}, [],
    );
    assert.equal(messages.some((message) => message.content.includes("ABSENCE PENALTY")), false);
    const envelopes = messages.flatMap((message) => {
      try { return [JSON.parse(message.content)]; } catch { return []; }
    });
    assert.deepEqual(envelopes.find((item) => item.type === "student_challenge_answers").data, { shippingDays: 4 });
    assert.deepEqual(envelopes.find((item) => item.type === "student_decisions").data, { inventory: 72 });
  });
}

for (const [failure, expectedError] of [
  ["locked", /Submissions are closed/],
  ["invalid-decision", /Invalid decision variables/],
  ["invalid-challenge", /Invalid challenge variable answers/],
  ["delete", /Value deletion failed/],
  ["insert", /Value insertion failed/],
]) {
  test(`${failure} submission failure preserves the stored generation metadata`, async (t) => {
    const fixture = submissionFixture(t, "DEFAULTS", failure);
    await assert.rejects(fixture.submit(), expectedError);
    assert.deepEqual(fixture.stored().generation, fixture.originalGeneration);
    assert.deepEqual(fixture.stored().challengeVariableAnswers, { shippingDays: 2 });
    assert.equal(fixture.writes.includes("save-decision"), false);
  });
}

test("background processing status updates preserve default participation metadata", async (t) => {
  const fixture = submissionFixture(t);
  await fixture.decision.updateProcessingStatus("completed");
  assert.equal(fixture.stored().processingStatus, "completed");
  assert.deepEqual(fixture.stored().generation, fixture.originalGeneration);
});
