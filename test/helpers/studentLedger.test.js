const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");

require("esbuild-register/dist/node").register({
  define: { "import.meta.env": "{}" },
});
const webRequire = createRequire(require.resolve("../../apps/web/package.json"));
const axios = webRequire("axios");
const TokenHandler = require("../../apps/web/src/services/base.tsx").default;
const ledgerService = require("../../apps/web/src/services/ledger.tsx").default;

test("student ledger lookup uses the authenticated student challenge route", async (t) => {
  t.mock.method(TokenHandler, "getHeaders", async () => ({ Authorization: "Bearer student" }));
  const entry = { _id: "ledger-id", metrics: { cashAfter: 1200 } };
  const get = t.mock.method(axios, "get", async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/v1/student/challenges/challenge-id");
    assert.deepEqual(options.headers, { Authorization: "Bearer student" });
    return { data: { success: true, data: { _id: "challenge-id", ledgerEntry: entry } } };
  });

  assert.deepEqual(await ledgerService.getMyEntryForScenario("challenge-id"), entry);
  assert.equal(get.mock.callCount(), 1);
});

test("pending results remain null instead of becoming a truthy response envelope", async (t) => {
  t.mock.method(TokenHandler, "getHeaders", async () => ({}));
  t.mock.method(axios, "get", async () => ({
    data: { success: true, data: { _id: "challenge-id", ledgerEntry: null } },
  }));
  assert.equal(await ledgerService.getMyEntryForScenario("challenge-id"), null);
});

test("student lookup propagates access errors without retrying an admin endpoint", async (t) => {
  t.mock.method(TokenHandler, "getHeaders", async () => ({}));
  const error = Object.assign(new Error("Not enrolled"), { response: { status: 403 } });
  const get = t.mock.method(axios, "get", async () => { throw error; });
  await assert.rejects(ledgerService.getMyEntryForScenario("challenge-id"), (value) => value === error);
  assert.equal(get.mock.callCount(), 1);
});
