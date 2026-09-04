const test = require("node:test");
const assert = require("node:assert/strict");

const Decision = require("./decision.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");

test("decision model exports submission statics", () => {
  assert.equal(typeof Decision.validateSubmissionVariables, "function");
  assert.equal(typeof Decision.prepareChallengeVariableAnswers, "function");
  assert.equal(typeof Decision.createSubmission, "function");
  assert.equal(typeof Decision.autoCreateDecisionsForChallenge, "function");
  assert.equal(typeof Decision.getMissingSubmissions, "function");
  assert.equal(typeof Decision.resolveDefaultVariables, "function");
});

test("decision schema stores challenge-specific student answers", () => {
  assert.ok(Decision.schema.path("challengeVariableAnswers"));
});

test("resolveDefaultVariables includes challenge-scoped decision defaults", async (t) => {
  const originals = {
    applyDefaults: VariableDefinition.applyDefaults,
    filterVariablesByActiveDefinitions:
      VariableDefinition.filterVariablesByActiveDefinitions,
    validateValues: VariableDefinition.validateValues,
  };
  t.after(() => {
    VariableDefinition.applyDefaults = originals.applyDefaults;
    VariableDefinition.filterVariablesByActiveDefinitions =
      originals.filterVariablesByActiveDefinitions;
    VariableDefinition.validateValues = originals.validateValues;
  });

  const receivedOptions = [];
  VariableDefinition.applyDefaults = async (_classroomId, _scope, _values, options) => {
    receivedOptions.push(options);
    return { inventoryTarget: 25 };
  };
  VariableDefinition.filterVariablesByActiveDefinitions = async (
    _classroomId,
    _scope,
    values,
    options,
  ) => {
    receivedOptions.push(options);
    return values;
  };
  VariableDefinition.validateValues = async (
    _classroomId,
    _scope,
    _values,
    options,
  ) => {
    receivedOptions.push(options);
    return { isValid: true, errors: [] };
  };

  const values = await Decision.resolveDefaultVariables(
    "classroom-id",
    "challenge-id",
  );

  assert.deepEqual(values, { inventoryTarget: 25 });
  assert.deepEqual(receivedOptions, [
    { challengeId: "challenge-id" },
    { challengeId: "challenge-id" },
    { challengeId: "challenge-id" },
  ]);
});
