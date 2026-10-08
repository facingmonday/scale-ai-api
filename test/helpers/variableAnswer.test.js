const test = require("node:test");
const assert = require("node:assert/strict");
require("esbuild-register/dist/node").register();
const { normalizeVariableAnswer, validateVariableAnswer } = require("../../apps/web/src/utils/variableAnswer.ts");
const { withRequestDeadline, RequestTimeoutError } = require("../../apps/web/src/utils/requestDeadline.ts");
const TokenHandler = require("../../apps/web/src/services/base.tsx").default;
const { authenticatedRequest } = require("../../apps/web/src/services/authenticatedRequest.ts");

test("required answers accept zero and false but reject missing values", () => {
  for (const [dataType, value] of [["number", 0], ["boolean", false], ["boolean", true]]) {
    const def = { dataType, required: true };
    assert.equal(validateVariableAnswer(def, value), true);
    for (const missing of [undefined, null, ""]) assert.equal(validateVariableAnswer(def, missing), "This field is required");
  }
});

test("normalization preserves empty answers and validates numeric bounds", () => {
  const def = { dataType: "number", required: true, min: 0, max: 100 };
  assert.equal(normalizeVariableAnswer("number", "50"), 50);
  assert.equal(normalizeVariableAnswer("boolean", "false"), false);
  assert.equal(normalizeVariableAnswer("number", ""), "");
  assert.equal(normalizeVariableAnswer("number", null), null);
  for (const value of [NaN, Infinity, "bad", " ", {}, []]) assert.notEqual(validateVariableAnswer(def, value), true);
  assert.equal(validateVariableAnswer(def, "50"), true);
  assert.equal(validateVariableAnswer(def, 101), "Must be at most 100");
  assert.equal(validateVariableAnswer(def, -1), "Must be at least 0");
});

test("deadline cancels token acquisition and never sends a late write", async () => {
  global.localStorage = { getItem: () => null };
  let release;
  TokenHandler.setTokenGetter(() => new Promise((resolve) => { release = resolve; }));
  let writes = 0;
  await assert.rejects(withRequestDeadline((signal) => authenticatedRequest(async () => { writes++; }, signal), undefined, 10), RequestTimeoutError);
  release("late-token");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes, 0);
});

test("deadline releases a hung request and passes cancellation to it", async () => {
  let signal;
  await assert.rejects(withRequestDeadline((s) => { signal = s; return new Promise(() => {}); }, undefined, 10), RequestTimeoutError);
  assert.equal(signal.aborted, true);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(withRequestDeadline(() => assert.fail("must not start"), controller.signal), { name: "AbortError" });
});
