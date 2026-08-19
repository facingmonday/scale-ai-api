const test = require("node:test");
const assert = require("node:assert/strict");
const VariableDefinition = require("./variableDefinition.model");

test("variableDefinition model schema exists", () => {
  assert.ok(VariableDefinition.schema);
});

test("challenge variable keys include the challenge ID", () => {
  assert.equal(
    VariableDefinition.createVariableKey({
      label: "What percentage of people will order?",
      appliesTo: "challenge",
      challengeId: "6a845c5571d7c3528705493d",
    }),
    "what-percentage-of-people-will-order--6a845c5571d7c3528705493d",
  );
});

test("non-challenge variable keys remain label-based", () => {
  assert.equal(
    VariableDefinition.createVariableKey({
      label: "Price Elasticity",
      appliesTo: "decision",
    }),
    "price-elasticity",
  );
});

test("challenge variable keys require a challenge ID", () => {
  assert.throws(
    () =>
      VariableDefinition.createVariableKey({
        label: "Demand",
        appliesTo: "challenge",
      }),
    /challengeId is required/,
  );
});
