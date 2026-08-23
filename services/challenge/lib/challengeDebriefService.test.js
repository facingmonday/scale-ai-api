const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const {
  buildAnonymousAggregateFromRows,
  buildOpenAIRequest,
} = require("./challengeDebriefService");

test("builds only anonymous cohort summaries and selects the leaderboard metric", () => {
  const aggregate = buildAnonymousAggregateFromRows({
    rows: [
      {
        profileType: "Urban",
        metrics: { profit: 10, satisfaction: 90 },
        decisionVariables: { price: 4, notes: "student-secret" },
        challengeVariables: {},
        studentName: "Ada Student",
        shopName: "Ada's Shop",
      },
      {
        profileType: "Rural",
        metrics: { profit: 30, satisfaction: 70 },
        decisionVariables: { price: 8, notes: "another-secret" },
        challengeVariables: {},
        studentName: "Grace Student",
        shopName: "Grace's Shop",
      },
    ],
    metricDefinitions: [
      { key: "profit", label: "Profit", dataType: "number" },
      {
        key: "satisfaction",
        label: "Satisfaction",
        dataType: "number",
        displayIn: { leaderboard: true },
      },
    ],
    variableDefinitions: [
      {
        key: "price",
        label: "Price",
        appliesTo: "decision",
        dataType: "number",
      },
      {
        key: "notes",
        label: "Student notes",
        appliesTo: "decision",
        dataType: "string",
      },
    ],
  });

  assert.deepEqual(aggregate.performanceMetric, {
    key: "satisfaction",
    label: "Satisfaction",
  });
  assert.equal(aggregate.totalResults, 2);
  assert.equal(aggregate.profileTypeGroups.length, 2);
  assert.equal(aggregate.decisionVariableGroups.length, 2);
  assert.deepEqual(
    aggregate.decisionVariableGroups.find((group) => group.key === "notes").groups.map(
      (group) => group.value,
    ),
    ["provided"],
  );

  const requestText = JSON.stringify(buildOpenAIRequest(aggregate));
  for (const forbidden of [
    "Ada Student",
    "Grace Student",
    "Ada's Shop",
    "Grace's Shop",
    "student-secret",
    "another-secret",
  ]) {
    assert.equal(requestText.includes(forbidden), false);
  }
});

test("falls back to the first numeric metric", () => {
  const aggregate = buildAnonymousAggregateFromRows({
    rows: [{ metrics: { revenue: 12 }, decisionVariables: {}, challengeVariables: {} }],
    metricDefinitions: [
      { key: "label", label: "Label", dataType: "string" },
      { key: "revenue", label: "Revenue", dataType: "number" },
    ],
    variableDefinitions: [],
  });

  assert.equal(aggregate.performanceMetric.key, "revenue");
});
