const test = require("node:test");
const assert = require("node:assert/strict");

const LedgerEntry = require("./ledger.model");

test("ledger model exports AI simulation helpers", () => {
  assert.equal(typeof LedgerEntry.buildAISimulationPrompt, "function");
  assert.equal(typeof LedgerEntry.buildAISimulationOpenAIRequest, "function");
  assert.equal(typeof LedgerEntry.normalizeAndValidateAISimulationResult, "function");
  assert.equal(typeof LedgerEntry.runAISimulation, "function");
});

test("hardenAISimulationMessages prepends policy and normalizes roles to user", () => {
  const messages = [
    { role: "system", content: "sys" },
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "developer", content: "dev" },
  ];

  const hardened = LedgerEntry.hardenAISimulationMessages(messages);
  assert.equal(hardened.length, 5);
  assert.equal(hardened[0].role, "system");
  assert.equal(hardened.filter((m) => m.role === "user").length, 4);
});
