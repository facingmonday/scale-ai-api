const LedgerEntry = require("../ledger.model");

/**
 * Ledger Service
 * Handles all ledger-related operations
 */
class LedgerService {
  /**
   * Create a ledger entry
   * @param {Object} input - Ledger entry data
   * @param {string} organizationId - Organization ID
   * @param {string} clerkUserId - Clerk user ID
   * @returns {Promise<Object>} Created ledger entry
   */
  static async createLedgerEntry(input, organizationId, clerkUserId) {
    return await LedgerEntry.createLedgerEntry(
      input,
      organizationId,
      clerkUserId
    );
  }

  /**
   * Get ledger history for a user in a class
   * @param {string} classId - Class ID
   * @param {string} userId - Member ID
   * @param {string} excludeScenarioId - Optional scenario ID to exclude (for reruns)
   * @returns {Promise<Array>} Ordered list of ledger entries
   */
  static async getLedgerHistory(classId, userId, excludeScenarioId = null) {
    return await LedgerEntry.getLedgerHistory(classId, userId, excludeScenarioId);
  }

  /**
   * Get ledger entry for a specific scenario and user
   * @param {string} scenarioId - Scenario ID
   * @param {string} userId - Member ID
   * @returns {Promise<Object|null>} Ledger entry or null
   */
  static async getLedgerEntry(scenarioId, userId) {
    return await LedgerEntry.getLedgerEntry(scenarioId, userId);
  }

  /**
   * Delete all ledger entries for a scenario (used during reruns)
   * @param {string} scenarioId - Scenario ID
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteLedgerEntriesForScenario(scenarioId) {
    return await LedgerEntry.deleteLedgerEntriesForScenario(scenarioId);
  }

  /**
   * Override a ledger entry (admin-only)
   * @param {string} ledgerId - Ledger entry ID
   * @param {Object} patch - Fields to override
   * @param {string} clerkUserId - Clerk user ID
   * @param {string} adminUserId - Admin member ID
   * @returns {Promise<Object>} Updated ledger entry
   */
  static async overrideLedgerEntry(ledgerId, patch, clerkUserId, adminUserId) {
    return await LedgerEntry.overrideLedgerEntry(
      ledgerId,
      patch,
      clerkUserId,
      adminUserId
    );
  }

  /**
   * Get all ledger entries for a scenario
   * @param {string} scenarioId - Scenario ID
   * @returns {Promise<Array>} Array of ledger entries
   */
  static async getLedgerEntriesByScenario(scenarioId) {
    return await LedgerEntry.getLedgerEntriesByScenario(scenarioId);
  }
}

module.exports = LedgerService;

