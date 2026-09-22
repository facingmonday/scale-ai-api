const test = require("node:test");
const assert = require("node:assert/strict");
require("esbuild-register/dist/node").register({ jsx: "automatic" });
const {
  SuggestionDeck,
  wizardReducer,
  initialWizardState,
  variableError,
} = require("../../apps/web/src/utils/challengeWizard.ts");
const variable = {
  label: "How much inventory?",
  description: "Balance demand and waste.",
  dataType: "number",
  inputType: "slider",
  min: 0,
  max: 100,
  defaultValue: 50,
  required: true,
  options: [],
};
const candidates = [1, 2, 3].map((n) => ({
  title: `Challenge ${n}`,
  description: "Scenario",
}));
test("changes retain later work and require confirmation; add/remove/edit all invalidate outcome", () => {
  let s = initialWizardState();
  s = wizardReducer(s, { type: "challenge", value: candidates[0] });
  s = wizardReducer(s, { type: "confirm", step: 0 });
  s = wizardReducer(s, { type: "variables", value: [variable] });
  s = wizardReducer(s, { type: "confirm", step: 1 });
  s = wizardReducer(s, {
    type: "outcome",
    value: { notes: "Demand surged.", hiddenNotes: "Apply capacity bounds." },
  });
  s = wizardReducer(s, { type: "confirm", step: 2 });
  assert.deepEqual(s.confirmed, [true, true, true]);
  const selected = s.draft;
  s = wizardReducer(s, { type: "challenge", value: candidates[1] });
  assert.deepEqual(s.confirmed, [false, false, false]);
  assert.equal(s.draft.variables, selected.variables);
  assert.equal(s.draft.outcome, selected.outcome);
  s = wizardReducer(s, { type: "confirm", step: 0 });
  s = wizardReducer(s, {
    type: "variables",
    value: [{ ...variable, defaultValue: 25 }],
  });
  assert.deepEqual(s.confirmed, [true, false, false]);
  s = wizardReducer(s, { type: "variables", value: [] });
  assert.equal(s.draft.outcome, selected.outcome);
  assert.deepEqual(wizardReducer(s, { type: "reset" }), initialWizardState());
});
test("deck browses prepared alternatives and preserves previous suggestions", async () => {
  const deck = new SuggestionDeck(() => {});
  deck.configure("context-a");
  let selected;
  await deck.refill(
    async () => candidates,
    (c) => {
      selected = c;
    },
  );
  assert.equal(selected, candidates[0]);
  assert.equal(deck.remaining, 2);
  assert.equal(deck.next(), candidates[1]);
  assert.equal(deck.remaining, 1);
  await deck.refill(
    async (_signal, rejected) => {
      assert.equal(rejected.length, 3);
      return candidates;
    },
    () => assert.fail("Background refill must not replace selection"),
  );
  assert.equal(deck.current, candidates[1]);
  assert.equal(deck.previous(), candidates[0]);
});
test("context changes cancel pending requests and ignore late responses", async () => {
  const deck = new SuggestionDeck(() => {});
  deck.configure("a");
  let resolve, signal;
  const promise = deck.refill(
    (s) => {
      signal = s;
      return new Promise((r) => {
        resolve = r;
      });
    },
    () => assert.fail("Stale selection"),
  );
  deck.configure("b");
  assert.equal(signal.aborted, true);
  resolve(candidates);
  await promise;
  assert.equal(deck.current, null);
  assert.equal(deck.loading, false);
});
test("failure preserves cards, permits retry, and suppresses concurrent refills", async () => {
  const deck = new SuggestionDeck(() => {});
  await deck.refill(
    async () => candidates,
    () => {},
  );
  let reject;
  const first = deck.refill(
    () =>
      new Promise((_resolve, r) => {
        reject = r;
      }),
    () => {},
  );
  await deck.refill(
    () => assert.fail("Duplicate request"),
    () => {},
  );
  reject(new Error("Offline"));
  await first;
  assert.equal(deck.current, candidates[0]);
  assert.equal(deck.error, "Offline");
  await deck.refill(
    async () => candidates,
    () => {},
  );
  assert.equal(deck.error, null);
});
test("variable editor rejects invalid bounds and defaults", () => {
  assert.equal(variableError(variable), null);
  assert.match(variableError({ ...variable, defaultValue: 101 }), /range/);
  assert.match(variableError({ ...variable, min: null }), /minimum/);
});
