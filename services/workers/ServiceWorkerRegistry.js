/**
 * Service Worker Registry
 *
 * This registry maintains a list of all available workers and their configurations.
 * Workers can be system-wide or organization-specific.
 */

class ServiceWorkerRegistry {
  constructor() {
    this.workers = new Map();
    this.registerDefaultWorkers();
  }

  /**
   * Register default system workers
   */
  registerDefaultWorkers() {
    // Ticket Reminder Worker - System-wide job
    this.registerWorker("ticket-reminder", {
      name: "Ticket Reminder Worker",
      description:
        "Sends reminder emails to ticket holders the day before their events",
      isSystemWorker: true, // Runs across all organizations
      requiresOrganization: false,
      defaultSchedule: "0 11 * * *", // 10 AM CST (3 PM UTC)
      timezone: "America/Chicago",
      maxExecutionTime: 5 * 60 * 1000, // 5 minutes
      retryOnFailure: true,
      maxRetries: 3,
      enabled: true,
    });

    // Daily Stats Worker - Organization-specific job
    // this.registerWorker("daily-stats", {
    //   name: "Daily Stats Worker",
    //   description:
    //     "Sends daily statistics emails to organization administrators with comprehensive performance metrics",
    //   isSystemWorker: false, // Organization-specific
    //   requiresOrganization: true,
    //   defaultSchedule: "0 13 * * *", // 8 AM CST (1 PM UTC)
    //   timezone: "America/Chicago",
    //   maxExecutionTime: 10 * 60 * 1000, // 10 minutes
    //   retryOnFailure: true,
    //   maxRetries: 2,
    //   enabled: true,
    // });

    // // Email Digest Worker - Organization-specific (example)
    // this.registerWorker("email-digest", {
    //   name: "Email Digest Worker",
    //   description: "Sends daily/weekly email digests to organization members",
    //   isSystemWorker: false,
    //   requiresOrganization: true,
    //   defaultSchedule: "0 12 * * *", // 7 AM CST (12 PM UTC)
    //   timezone: "America/Chicago",
    //   maxExecutionTime: 10 * 60 * 1000, // 10 minutes
    //   retryOnFailure: true,
    //   maxRetries: 2,
    //   enabled: false, // Disabled by default, organizations can enable
    // });

    // // Data Cleanup Worker - System-wide (example)
    this.registerWorker("cart-cleanup", {
      name: "Cart Cleanup Worker",
      description: "Expires abandoned carts whose expiresAt is in the past",
      isSystemWorker: true,
      requiresOrganization: false,
      defaultSchedule: "*/15 * * * *", // Every 5 minutes
      timezone: "America/Chicago",
      maxExecutionTime: 60 * 1000, // 1 minute
      retryOnFailure: true,
      maxRetries: 1,
      enabled: true,
    });
  }

  /**
   * Register a new worker
   * @param {string} workerType - Unique identifier for the worker
   * @param {Object} config - Worker configuration
   */
  registerWorker(workerType, config) {
    const requiredFields = ["name", "description"];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Worker config missing required field: ${field}`);
      }
    }

    // Set defaults
    const workerConfig = {
      isSystemWorker: false,
      requiresOrganization: true,
      defaultSchedule: "0 9 * * *", // 4 AM CST (9 AM UTC)
      timezone: "America/Chicago",
      maxExecutionTime: 5 * 60 * 1000, // 5 minutes
      retryOnFailure: false,
      maxRetries: 0,
      enabled: true,
      ...config,
    };

    this.workers.set(workerType, workerConfig);
    console.log(`✅ Registered worker: ${workerType} (${workerConfig.name})`);
  }

  /**
   * Get worker configuration
   * @param {string} workerType - Worker type identifier
   * @returns {Object|null} Worker configuration or null if not found
   */
  getWorker(workerType) {
    return this.workers.get(workerType) || null;
  }

  /**
   * Get all registered workers
   * @returns {Map} Map of all registered workers
   */
  getAllWorkers() {
    return new Map(this.workers);
  }

  /**
   * Get all system workers (organization-independent)
   * @returns {Array} Array of system worker configurations with types
   */
  getSystemWorkers() {
    const systemWorkers = [];
    for (const [workerType, config] of this.workers.entries()) {
      if (config.isSystemWorker) {
        systemWorkers.push({ workerType, ...config });
      }
    }
    return systemWorkers;
  }

  /**
   * Get all organization-specific workers
   * @returns {Array} Array of organization worker configurations with types
   */
  getOrganizationWorkers() {
    const orgWorkers = [];
    for (const [workerType, config] of this.workers.entries()) {
      if (!config.isSystemWorker && config.requiresOrganization) {
        orgWorkers.push({ workerType, ...config });
      }
    }
    return orgWorkers;
  }

  /**
   * Check if a worker type exists
   * @param {string} workerType - Worker type to check
   * @returns {boolean} True if worker exists
   */
  hasWorker(workerType) {
    return this.workers.has(workerType);
  }

  /**
   * Get worker types that are enabled by default
   * @returns {Array} Array of enabled worker types
   */
  getEnabledWorkerTypes() {
    const enabledTypes = [];
    for (const [workerType, config] of this.workers.entries()) {
      if (config.enabled) {
        enabledTypes.push(workerType);
      }
    }
    return enabledTypes;
  }

  /**
   * Remove a worker from the registry
   * @param {string} workerType - Worker type to remove
   * @returns {boolean} True if worker was removed
   */
  unregisterWorker(workerType) {
    return this.workers.delete(workerType);
  }

  /**
   * Update worker configuration
   * @param {string} workerType - Worker type to update
   * @param {Object} updates - Configuration updates
   * @returns {boolean} True if worker was updated
   */
  updateWorker(workerType, updates) {
    const existingConfig = this.workers.get(workerType);
    if (!existingConfig) {
      return false;
    }

    const updatedConfig = { ...existingConfig, ...updates };
    this.workers.set(workerType, updatedConfig);
    return true;
  }

  /**
   * Print registry status for debugging
   */
  printStatus() {
    console.log("\n📋 SERVICE WORKER REGISTRY STATUS");
    console.log("=================================");
    console.log(`Total workers: ${this.workers.size}`);

    const systemWorkers = this.getSystemWorkers();
    const orgWorkers = this.getOrganizationWorkers();

    console.log(`System workers: ${systemWorkers.length}`);
    console.log(`Organization workers: ${orgWorkers.length}`);

    console.log("\n🔧 REGISTERED WORKERS:");
    for (const [workerType, config] of this.workers.entries()) {
      const type = config.isSystemWorker ? "SYSTEM" : "ORG";
      const status = config.enabled ? "✅" : "❌";
      console.log(
        `${status} [${type}] ${workerType}: ${config.name} (${config.defaultSchedule} ${config.timezone})`
      );
    }
    console.log("");
  }
}

// Create and export singleton instance
const registry = new ServiceWorkerRegistry();

module.exports = registry;
