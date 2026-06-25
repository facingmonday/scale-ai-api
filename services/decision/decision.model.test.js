const test = require("node:test");
const assert = require("node:assert/strict");

const Decision = require("./decision.model");

test("decision model exports submission statics", () => {
  assert.equal(typeof Decision.validateSubmissionVariables, "function");
  assert.equal(typeof Decision.createSubmission, "function");
  assert.equal(typeof Decision.autoCreateDecisionsForChallenge, "function");
  assert.equal(typeof Decision.getMissingSubmissions, "function");
});
