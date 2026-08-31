const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("./metricDefinition.model");

test("metricDefinition.model schema has required organization field", () => {
  assert.ok(Model.schema.obj.organization !== undefined || Model.schema.paths.organization);
});

test("selects the explicitly configured primary leaderboard metric", () => {
  const definitions = [
    {
      key: "revenue",
      dataType: "number",
      isActive: true,
      displayIn: { leaderboard: true },
      sortOrder: 10,
    },
    {
      key: "customerWaitTime",
      dataType: "number",
      isActive: true,
      displayIn: { leaderboard: true },
      isPrimaryLeaderboardMetric: true,
      sortOrder: 20,
    },
  ];

  assert.equal(
    Model.selectLeaderboardDefinition(definitions).key,
    "customerWaitTime"
  );
});

test("selects arbitrary leaderboard metrics by configuration", () => {
  const definitions = [
    {
      key: "throughput",
      label: "Throughput",
      dataType: "number",
      isActive: true,
      displayIn: { leaderboard: true },
      leaderboardSortDirection: "desc",
      sortOrder: 20,
    },
    {
      key: "waitTime",
      label: "Wait Time",
      dataType: "number",
      isActive: true,
      displayIn: { leaderboard: true },
      leaderboardSortDirection: "asc",
      sortOrder: 10,
    },
    {
      key: "notes",
      dataType: "string",
      isActive: true,
      displayIn: { leaderboard: true },
      sortOrder: 1,
    },
    {
      key: "inactiveScore",
      dataType: "number",
      isActive: false,
      displayIn: { leaderboard: true },
      sortOrder: 2,
    },
    {
      key: "hiddenScore",
      dataType: "number",
      isActive: true,
      displayIn: { leaderboard: false },
      sortOrder: 3,
    },
  ];

  const selected = Model.selectLeaderboardDefinitions(definitions);
  assert.deepEqual(
    selected.map(({ definition, direction }) => [definition.key, direction]),
    [
      ["waitTime", "asc"],
      ["throughput", "desc"],
    ]
  );
});

test("uses the first configured leaderboard metric when no primary is set", () => {
  const definitions = [
    {
      key: "followers",
      label: "Followers",
      dataType: "number",
      isActive: true,
      displayIn: { leaderboard: true },
      sortOrder: 20,
    },
    {
      key: "engagementRate",
      label: "Engagement Rate",
      dataType: "number",
      isActive: true,
      displayIn: { leaderboard: true },
      sortOrder: 10,
    },
  ];

  assert.equal(
    Model.selectLeaderboardDefinition(definitions).key,
    "engagementRate"
  );
});

test("returns no primary when no eligible leaderboard metrics exist", () => {
  assert.equal(
    Model.selectLeaderboardDefinition([
      {
        key: "revenue",
        dataType: "number",
        isActive: true,
        displayIn: { leaderboard: false },
      },
    ]),
    null
  );
});
