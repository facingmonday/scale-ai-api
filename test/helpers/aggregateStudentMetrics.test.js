const test = require("node:test");
const assert = require("node:assert/strict");
require("esbuild-register/dist/node").register({ jsx: "automatic" });

const { aggregateStudentMetrics } = require("../../apps/web/src/utils/aggregateStudentMetrics.ts");

const definitions = [
  ["sales", "sum"],
  ["revenue", "sum"],
  ["costs", "sum"],
  ["netProfit", "sum"],
  ["cashAfter", "last"],
].map(([key, aggregation]) => ({
  key, label: key, dataType: "number", format: "currency", aggregation,
  displayIn: { kpi: true },
}));

const results = [
  { metrics: { sales: 100, revenue: 1600, costs: 1178.47, netProfit: 421.53, cashAfter: 16681.34 } },
  { metrics: { sales: 82, revenue: 1312, costs: 976.23, netProfit: 335.77, cashAfter: 16259.81 } },
  { metrics: { sales: 110, revenue: 1980, costs: 1362.67, netProfit: 617.33, cashAfter: 15924.04 } },
  { metrics: { sales: 82, revenue: 1312, costs: 1005.29, netProfit: 306.71, cashAfter: 15306.71 } },
];

test("classroom totals include every released result and keep the latest cash balance", () => {
  const before = structuredClone(results);
  const totals = aggregateStudentMetrics(results, definitions);
  assert.equal(totals.sales, 374);
  assert.equal(totals.revenue, 6204);
  assert.equal(totals.costs.toFixed(2), "4522.66");
  assert.equal(totals.netProfit.toFixed(2), "1681.34");
  assert.equal(totals.cashAfter, 16681.34);
  assert.deepEqual(results, before);
  assert.deepEqual(aggregateStudentMetrics([], definitions), {});
});

test("custom aggregation ignores missing or invalid values and preserves zero", () => {
  const customDefinitions = ["sum", "avg", "min", "max", "last", "none"].map(
    (aggregation) => ({ key: aggregation, aggregation, dataType: "number" })
  );
  const entries = [null, NaN, "", 0, 20, 10].map((value) => ({
    metrics: Object.fromEntries(customDefinitions.map(({ key }) => [key, value])),
  }));
  assert.deepEqual(aggregateStudentMetrics(entries, customDefinitions), {
    sum: 30, avg: 10, min: 0, max: 20, last: 0, none: 0,
  });
  assert.deepEqual(aggregateStudentMetrics([{ metrics: {} }], definitions), {});
});

test("dashboard renders cumulative cards above unchanged latest-week cards", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { MemoryRouter } = require("react-router-dom");
  // Bundle local imports so the component's Vite path aliases resolve in Node.
  const path = require("node:path");
  const { buildSync } = require("esbuild");
  const compiled = buildSync({
    entryPoints: [path.resolve(__dirname, "../../apps/web/src/components/dashboard/StudentDashboardInsights.tsx")],
    tsconfig: path.resolve(__dirname, "../../apps/web/tsconfig.app.json"),
    bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  });
  const componentModule = { exports: {} };
  require("node:vm").runInNewContext(compiled.outputFiles[0].text, { require, module: componentModule });
  const StudentDashboardInsights = componentModule.exports.default;
  const recentResults = results.map((result, index) => ({
    ...result, challengeId: String(index), title: `Week ${4 - index}`, week: 4 - index,
  }));
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(StudentDashboardInsights, {
      dashboard: {
        className: "Test Classroom", profile: { shopName: "Test Shop" },
        metricDefinitions: definitions, recentResults, latestResult: recentResults[0],
        completedChallengeCount: 4, activeScenario: null, classStatistics: null,
      },
    })
  ));
  const topRow = html.match(/<section aria-label="Classroom totals">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(topRow);
  assert.match(topRow, /4 released challenges/);
  assert.match(topRow, /\$6,204\.00/);
  assert.match(topRow, /\$16,681\.34/);
  assert.doesNotMatch(topRow, /\$1,600\.00/);
  const weeklySection = html.slice(html.indexOf("Latest weekly results"));
  assert.match(weeklySection, /\$1,600\.00/);
  assert.doesNotMatch(weeklySection, /\$6,204\.00/);
});
