const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("./metricDefinition.model");

test("metricDefinition.model schema has required organization field", () => {
  assert.ok(Model.schema.obj.organization !== undefined || Model.schema.paths.organization);
});

test("supply-chain leaderboards use net profit despite legacy flags", () => {
  const definitions = [
    "sales",
    "revenue",
    "costs",
    "waste",
    "netProfit",
    "cashBefore",
    "cashAfter",
  ].map((key) => ({
    key,
    dataType: "number",
    displayIn: { leaderboard: key === "revenue" || key === "cashAfter" },
  }));

  assert.equal(
    Model.selectLeaderboardDefinition(definitions).key,
    "netProfit"
  );
});

test("supply-chain dashboards select six ordered categories and directions", () => {
  const definitions = [
    "sales",
    "revenue",
    "costs",
    "waste",
    "netProfit",
    "cashBefore",
    "cashAfter",
  ].map((key) => ({ key, label: key, dataType: "number" }));

  const selected = Model.selectLeaderboardDefinitions(definitions);
  assert.deepEqual(
    selected.map(({ definition, direction }) => [definition.key, direction]),
    [
      ["netProfit", "desc"],
      ["sales", "desc"],
      ["revenue", "desc"],
      ["costs", "asc"],
      ["waste", "asc"],
      ["cashAfter", "desc"],
    ]
  );
});

test("other classroom types retain their configured leaderboard metric", () => {
  const definitions = [
    { key: "followers", dataType: "number" },
    {
      key: "engagementRate",
      dataType: "number",
      displayIn: { leaderboard: true },
    },
  ];

  assert.equal(
    Model.selectLeaderboardDefinition(definitions).key,
    "engagementRate"
  );
});
