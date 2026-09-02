const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("./classroomTemplate.model");

test("classroomTemplate.model schema has required organization field", () => {
  assert.ok(Model.schema.obj.organization !== undefined || Model.schema.paths.organization);
});

test("pizza-shop templates expose the six cumulative leaderboard metrics", () => {
  const definitions = Model.getPizzaShopMetricDefinitions();
  const leaderboardMetrics = definitions
    .filter((definition) => definition.displayIn?.leaderboard)
    .map((definition) => definition.key);

  assert.deepEqual(leaderboardMetrics, [
    "sales",
    "revenue",
    "costs",
    "waste",
    "netProfit",
    "cashAfter",
  ]);
  assert.equal(
    definitions.find((definition) => definition.isPrimaryLeaderboardMetric)?.key,
    "netProfit"
  );
  assert.equal(
    definitions.find((definition) => definition.key === "costs")
      .leaderboardSortDirection,
    "asc"
  );
  assert.equal(
    definitions.find((definition) => definition.key === "waste")
      .leaderboardSortDirection,
    "asc"
  );
});

test("pizza-shop templates include production-capacity conversion guardrails", () => {
  const prompts = Model.getPizzaShopPrompts();
  const combined = prompts.map((prompt) => prompt.content).join("\n");

  assert.match(
    combined,
    /PRODUCTION CAPACITY AND INVENTORY USAGE \(REQUIRED\)/
  );
  assert.match(
    combined,
    /availableUnitsForProduction × goodsPerUnit/
  );
  assert.match(
    combined,
    /NEVER divide available inventory units by goods-per-unit/
  );
  assert.doesNotMatch(combined, /Default consumption order:/);
});

test("default profile types have distinct selling prices", () => {
  const values = Model.getDefaultStoreTypeValuesByStoreTypeKey();

  assert.equal(values.food_truck["avg-selling-price-per-unit"], 10);
  assert.equal(values.cafe["avg-selling-price-per-unit"], 20);
  assert.equal(values.bar_and_grill["avg-selling-price-per-unit"], 22);
  assert.equal(values.fine_dining["avg-selling-price-per-unit"], 48);
  assert.equal(values.street_cart["avg-selling-price-per-unit"], 7);
  assert.equal(values.late_night_window["avg-selling-price-per-unit"], 11);
  assert.equal(values.ghost_kitchen["avg-selling-price-per-unit"], 24);
  assert.equal(values.campus_kiosk["avg-selling-price-per-unit"], 6);
  assert.equal(values.upscale_bistro["avg-selling-price-per-unit"], 36);
  assert.equal(values.festival_vendor["avg-selling-price-per-unit"], 9);
  assert.equal(values.franchise_location["avg-selling-price-per-unit"], 18);
});

test("repairs the known uniform-$16 template signature", () => {
  const defaults = Model.getDefaultStoreTypeValuesByStoreTypeKey();
  const staleValues = Object.fromEntries(
    Object.entries(defaults).map(([profileTypeKey, values]) => [
      profileTypeKey,
      {
        ...values,
        "average-selling-price-per-unit": 16,
        "avg-selling-price-per-unit": 16,
      },
    ])
  );

  const result = Model.repairLegacyUniformSellingPrices(staleValues);

  assert.equal(result.changed, true);
  assert.equal(
    result.values.fine_dining["average-selling-price-per-unit"],
    48
  );
  assert.equal(
    result.values.fine_dining["avg-selling-price-per-unit"],
    48
  );
  assert.equal(
    result.values.campus_kiosk["average-selling-price-per-unit"],
    6
  );
});

test("does not overwrite administrator-authored selling prices", () => {
  const customized = Model.getDefaultStoreTypeValuesByStoreTypeKey();
  customized.fine_dining["avg-selling-price-per-unit"] = 55;

  const result = Model.repairLegacyUniformSellingPrices(customized);

  assert.equal(result.changed, false);
  assert.equal(result.values.fine_dining["avg-selling-price-per-unit"], 55);
});
