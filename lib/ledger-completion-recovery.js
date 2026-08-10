function createLedgerCompletionRecovery({
  ensureDbConnected,
  recoverUndeliveredEvents,
  logger = console,
}) {
  let recoveryInProgress = false;

  return async function recoverLedgerCompletionEvents() {
    if (recoveryInProgress) return { skipped: true };
    recoveryInProgress = true;

    try {
      await ensureDbConnected();
      const result = await recoverUndeliveredEvents();
      if (result.recovered > 0) {
        logger.log(
          `♻️ Re-enqueued ${result.recovered} ledger completion event(s)`,
        );
      }
      return { ...result, skipped: false };
    } catch (error) {
      logger.error(
        "❌ Ledger completion event recovery failed:",
        error.message,
      );
      return { skipped: false, error };
    } finally {
      recoveryInProgress = false;
    }
  };
}

module.exports = { createLedgerCompletionRecovery };
