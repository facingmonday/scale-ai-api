const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const simulationJobSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: true,
  },
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Submission",
    required: false,
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "running", "completed", "failed"],
    default: "pending",
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  error: {
    type: String,
    default: null,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  dryRun: {
    type: Boolean,
    default: false,
  },
  // Prepared OpenAI payload (for Batch processing).
  // Stored as schema-light to allow OpenAI SDK shape changes without migrations.
  openaiRequest: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  // Raw (pre-hardening) prompt messages for audit/debug.
  openaiRequestRawMessages: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  openaiRequestPreparedAt: {
    type: Date,
    default: null,
  },
  // Expected continuity values (used to correct AI responses during ingestion)
  expectedCashBefore: {
    type: Number,
    default: null,
  },
  expectedInventoryState: {
    refrigeratedUnits: { type: Number, default: null },
    ambientUnits: { type: Number, default: null },
    notForResaleUnits: { type: Number, default: null },
  },
  // Snapshot of variables/prior state used to write ledger entries later during batch ingestion
  calculationContextSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  // Batch tracking (one job item within a scenario-level batch)
  batch: {
    openaiBatchId: { type: String, default: null, index: true },
    inputFileId: { type: String, default: null },
    outputFileId: { type: String, default: null },
    errorFileId: { type: String, default: null },
    submittedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  ledgerEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerEntry",
    default: null,
  },
}).add(baseSchema);

// Compound indexes for performance
simulationJobSchema.index({ scenarioId: 1, userId: 1 }, { unique: true });
simulationJobSchema.index({ status: 1 });
simulationJobSchema.index({ scenarioId: 1, status: 1 });
simulationJobSchema.index({ classroomId: 1, userId: 1 });
simulationJobSchema.index({ organization: 1, scenarioId: 1 });
simulationJobSchema.index({ submissionId: 1 });
simulationJobSchema.index({ "batch.openaiBatchId": 1, status: 1 });

// Static methods

/**
 * Create a simulation job
 * @param {Object} input - Job data
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created job
 */
simulationJobSchema.statics.createJob = async function (
  input,
  organizationId,
  clerkUserId
) {
  // Check if job already exists
  const existing = await this.findOne({
    scenarioId: input.scenarioId,
    userId: input.userId,
  });

  if (existing) {
    // Reset existing job if it exists
    existing.status = "pending";
    existing.attempts = 0;
    existing.error = null;
    existing.startedAt = null;
    existing.completedAt = null;
    existing.dryRun = input.dryRun || false;
    // Clear any previously-prepared OpenAI/batch state so reruns don't reuse stale payloads.
    existing.openaiRequest = null;
    existing.openaiRequestRawMessages = null;
    existing.openaiRequestPreparedAt = null;
    existing.expectedCashBefore = null;
    existing.expectedInventoryState = {
      refrigeratedUnits: null,
      ambientUnits: null,
      notForResaleUnits: null,
    };
    existing.calculationContextSnapshot = null;
    existing.batch = {
      openaiBatchId: null,
      inputFileId: null,
      outputFileId: null,
      errorFileId: null,
      submittedAt: null,
      completedAt: null,
    };
    existing.ledgerEntryId = null;
    // Persist/refresh submission link if provided
    if (input.submissionId) {
      existing.submissionId = input.submissionId;
    }
    existing.updatedBy = clerkUserId;
    await existing.save();
    return existing;
  }

  const job = new this({
    classroomId: input.classroomId,
    scenarioId: input.scenarioId,
    submissionId: input.submissionId || null,
    userId: input.userId,
    status: "pending",
    attempts: 0,
    error: null,
    startedAt: null,
    completedAt: null,
    dryRun: input.dryRun || false,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await job.save();
  return job;
};

/**
 * Get jobs for a scenario
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<Array>} Array of jobs
 */
simulationJobSchema.statics.getJobsByScenario = async function (scenarioId) {
  return await this.find({ scenarioId })
    .populate("userId", "_id firstName lastName")
    .sort({ userId: 1 });
};

/**
 * Get pending jobs (for worker processing)
 * @param {number} limit - Maximum number of jobs to return
 * @returns {Promise<Array>} Array of pending jobs
 */
simulationJobSchema.statics.getPendingJobs = async function (limit = 10) {
  return await this.find({ status: "pending" })
    .sort({ createdDate: 1 })
    .limit(limit);
};

/**
 * Get job by ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>} Job or null
 */
simulationJobSchema.statics.getJobById = async function (jobId) {
  return await this.findById(jobId);
};

// Instance methods

/**
 * Mark job as running
 * @returns {Promise<Object>} Updated job
 */
simulationJobSchema.methods.markRunning = async function () {
  this.status = "running";
  this.startedAt = new Date();
  this.attempts += 1;
  await this.save();
  return this;
};

/**
 * Mark job as completed
 * @returns {Promise<Object>} Updated job
 */
simulationJobSchema.methods.markCompleted = async function () {
  this.status = "completed";
  this.completedAt = new Date();
  this.error = null;
  await this.save();
  return this;
};

/**
 * Mark job as failed
 * @param {string} errorMessage - Error message
 * @returns {Promise<Object>} Updated job
 */
simulationJobSchema.methods.markFailed = async function (errorMessage) {
  this.status = "failed";
  this.completedAt = new Date();
  this.error = errorMessage;
  await this.save();
  return this;
};

/**
 * Reset job for retry
 * @returns {Promise<Object>} Updated job
 */
simulationJobSchema.methods.reset = async function () {
  this.status = "pending";
  this.startedAt = null;
  this.completedAt = null;
  this.error = null;
  // Clear prepared/batch/ledger state so retries start clean.
  this.openaiRequest = null;
  this.openaiRequestRawMessages = null;
  this.openaiRequestPreparedAt = null;
  this.expectedCashBefore = null;
  this.expectedInventoryState = {
    refrigeratedUnits: null,
    ambientUnits: null,
    notForResaleUnits: null,
  };
  this.calculationContextSnapshot = null;
  this.batch = {
    openaiBatchId: null,
    inputFileId: null,
    outputFileId: null,
    errorFileId: null,
    submittedAt: null,
    completedAt: null,
  };
  this.ledgerEntryId = null;
  await this.save();
  return this;
};

const SimulationJob = mongoose.model("SimulationJob", simulationJobSchema);

module.exports = SimulationJob;
