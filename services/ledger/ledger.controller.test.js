const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./ledger.controller");

test("ledger controller exports handlers", () => {
  assert.equal(typeof controller.getLedgerHistory, "function");
});
