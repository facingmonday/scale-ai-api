const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createLedgerCompletionRecovery,
} = require("../../lib/ledger-completion-recovery");

test("ledger completion recovery does not overlap slow attempts", async () => {
  let finishRecovery;
  let attempts = 0;
  const messages = [];
  const recover = createLedgerCompletionRecovery({
    ensureDbConnected: async () => {},
    recoverUndeliveredEvents: async () => {
      attempts += 1;
      return new Promise((resolve) => {
        finishRecovery = resolve;
      });
    },
    logger: { log: (...args) => messages.push(args), error: () => {} },
  });

  const firstAttempt = recover();
  await Promise.resolve();
  assert.deepEqual(await recover(), { skipped: true });
  assert.equal(attempts, 1);

  finishRecovery({ recovered: 2, reconciledJobs: 1 });
  assert.deepEqual(await firstAttempt, {
    recovered: 2,
    reconciledJobs: 1,
    skipped: false,
  });
  assert.equal(messages.length, 1);
});

test("ledger completion recovery releases its lock after a connection error", async () => {
  let connectionAttempts = 0;
  const errors = [];
  const recover = createLedgerCompletionRecovery({
    ensureDbConnected: async () => {
      connectionAttempts += 1;
      if (connectionAttempts === 1) throw new Error("MongoDB unavailable");
    },
    recoverUndeliveredEvents: async () => ({
      recovered: 0,
      reconciledJobs: 0,
    }),
    logger: { log: () => {}, error: (...args) => errors.push(args) },
  });

  const failed = await recover();
  assert.equal(failed.error.message, "MongoDB unavailable");
  assert.equal(errors.length, 1);
  assert.deepEqual(await recover(), {
    recovered: 0,
    reconciledJobs: 0,
    skipped: false,
  });
  assert.equal(connectionAttempts, 2);
});
