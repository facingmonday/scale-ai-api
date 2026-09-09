const test = require("node:test");
const assert = require("node:assert/strict");
require("esbuild-register/dist/node").register({ jsx: "automatic" });
const TokenHandler = require("../../apps/web/src/services/base.tsx").default;
const { authenticatedRequest, AuthenticationRequiredError } = require("../../apps/web/src/services/authenticatedRequest.ts");
const { writeChallengeDraft, readChallengeDraft, clearChallengeDraft, persistChallengeDraft } = require("../../apps/web/src/utils/challengeDraft.ts");
const { createFormControl } = require("react-hook-form");

const httpError = (status) => ({ isAxiosError: true, response: { status } });
test.beforeEach(() => {
  global.localStorage = { getItem: () => null };
  const data = new Map();
  global.sessionStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
});

test("retries a rejected submission once with a freshly requested token", async () => {
  const options = [];
  TokenHandler.setTokenGetter(async (opts) => {
    options.push(opts);
    return opts.skipCache ? "fresh" : "old";
  });
  const sent = [];
  const saved = await authenticatedRequest(async (headers) => {
    sent.push(headers.Authorization);
    if (sent.length === 1) throw httpError(401);
    return { id: "saved-decision" };
  });
  assert.equal(saved.id, "saved-decision");
  assert.deepEqual(sent, ["Bearer old", "Bearer fresh"]);
  assert.deepEqual(options, [{ skipCache: false }, { skipCache: true }]);
});

test("persistent 401 requires authentication and never makes a third attempt", async () => {
  TokenHandler.setTokenGetter(async () => "invalid");
  let attempts = 0;
  await assert.rejects(authenticatedRequest(async () => {
    attempts++;
    throw httpError(401);
  }), AuthenticationRequiredError);
  assert.equal(attempts, 2);
});

test("missing session never sends an unauthenticated submission", async () => {
  TokenHandler.setTokenGetter(async () => null);
  let called = false;
  await assert.rejects(authenticatedRequest(async () => { called = true; }), AuthenticationRequiredError);
  assert.equal(called, false);
});

test("token network errors propagate without being treated as expired authentication", async () => {
  const offline = new Error("offline");
  TokenHandler.setTokenGetter(async () => { throw offline; });
  await assert.rejects(authenticatedRequest(async () => assert.fail("must not submit")), (error) => error === offline);
});

test("network, permission and server failures are never retried", async () => {
  TokenHandler.setTokenGetter(async () => "valid");
  for (const failure of [new Error("network interrupted"), httpError(403), httpError(500)]) {
    let calls = 0;
    await assert.rejects(authenticatedRequest(async () => {
      calls++;
      throw failure;
    }), (error) => error === failure);
    assert.equal(calls, 1);
  }
});

test("drafts survive authentication and remain scoped to their student and challenge", () => {
  const key = "challenge-draft:student-a:classroom-a:challenge-a";
  const values = { variables: { price: 0 }, challengeVariableAnswers: { reason: "My answer" } };
  writeChallengeDraft(key, values);
  assert.deepEqual(readChallengeDraft(key), values);
  assert.equal(readChallengeDraft("challenge-draft:student-b:classroom-a:challenge-a"), null);
  clearChallengeDraft(key);
  assert.equal(readChallengeDraft(key), null);
});

test("malformed drafts and unavailable storage do not break the form", () => {
  for (const value of ["invalid JSON", "null", '{"variables":[]}']) {
    sessionStorage.setItem("draft", value);
    assert.equal(readChallengeDraft("draft"), null);
  }
  global.sessionStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(readChallengeDraft("draft"), null);
  assert.doesNotThrow(() => writeChallengeDraft("draft", {}));
  assert.doesNotThrow(() => clearChallengeDraft("draft"));
});

test("student edits persist immediately but resetting after success does not recreate the draft", async () => {
  const form = createFormControl({ defaultValues: { variables: { price: 10 }, challengeVariableAnswers: {} } });
  const stop = persistChallengeDraft(form, "draft");
  const field = form.register("variables.price");
  await field.onChange({ target: { name: "variables.price", value: 25 }, type: "change" });
  assert.equal(readChallengeDraft("draft").variables.price, 25);
  const values = form.getValues();
  clearChallengeDraft("draft");
  form.reset(values);
  assert.equal(readChallengeDraft("draft"), null);
  stop();
});
