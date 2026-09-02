const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const {
  buildAnonymousAggregateFromRows,
  buildOpenAIRequest,
  normalizeDebrief,
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
      {
        key: "profit",
        label: "Profit",
        dataType: "number",
        displayIn: { leaderboard: true },
      },
      {
        key: "satisfaction",
        label: "Satisfaction",
        dataType: "number",
        displayIn: { leaderboard: true },
        isPrimaryLeaderboardMetric: true,
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

test("omits the performance metric when no leaderboard metric is configured", () => {
  const aggregate = buildAnonymousAggregateFromRows({
    rows: [{ metrics: { revenue: 12 }, decisionVariables: {}, challengeVariables: {} }],
    metricDefinitions: [
      { key: "label", label: "Label", dataType: "string" },
      { key: "revenue", label: "Revenue", dataType: "number" },
    ],
    variableDefinitions: [],
  });

  assert.equal(aggregate.performanceMetric, null);
});

test("normalizes every structured section and adds one card per profile type", () => {
  const aggregate = {
    performanceMetric: { key: "profit", label: "Profit" },
    profileTypeGroups: [
      {
        profileTypeKey: "urban",
        profileType: "Urban Store",
        count: 2,
        metrics: { profit: { label: "Profit", average: 15, min: 10, max: 20 } },
      },
      {
        profileTypeKey: "rural",
        profileType: "Rural Store",
        count: 1,
        metrics: { profit: { label: "Profit", average: 8, min: 8, max: 8 } },
      },
    ],
  };

  const debrief = normalizeDebrief(
    {
      summary: "The cohort adapted well.",
      strongerPatterns: ["Matched supply to demand."],
      weakerPatterns: ["Held excess inventory."],
      expectedVariation: ["Store capacity varied."],
      suspiciousAnomalies: ["One result needs review."],
      commonMistakes: ["Over-ordering."],
      discussionQuestions: ["What tradeoff drove your choice?"],
      suggestedInterventions: ["Model a cash-flow check."],
      profileTypeSummaries: [
        {
          key: "urban",
          label: "wrong label is replaced",
          participantCount: 999,
          summary: "Urban stores were resilient.",
          strengths: ["Demand response"],
          risks: ["High fixed cost"],
          recommendedFocus: ["Inventory timing"],
        },
      ],
    },
    aggregate,
  );

  assert.equal(debrief.profileTypeSummaries.length, 2);
  assert.deepEqual(
    debrief.profileTypeSummaries.map((item) => [item.key, item.label, item.participantCount]),
    [
      ["urban", "Urban Store", 2],
      ["rural", "Rural Store", 1],
    ],
  );
  assert.equal(debrief.profileTypeSummaries[1].summary.includes("1 result"), true);
  assert.equal(debrief.discussionQuestions.length, 1);
});

test("includes configured profile types even when they have no results", () => {
  const aggregate = buildAnonymousAggregateFromRows({
    rows: [],
    metricDefinitions: [],
    variableDefinitions: [],
    profileTypes: [
      { key: "campus", label: "Campus Store" },
      { key: "downtown", label: "Downtown Store" },
    ],
  });

  assert.deepEqual(
    aggregate.profileTypeGroups.map((group) => [
      group.profileTypeKey,
      group.profileType,
      group.count,
    ]),
    [
      ["campus", "Campus Store", 0],
      ["downtown", "Downtown Store", 0],
    ],
  );
});
