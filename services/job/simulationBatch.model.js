const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const simulationBatchSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: [
      "created",
      "submitted",
      "validating",
      "in_progress",
      "finalizing",
      "completed",
      "failed",
      "expired",
      "cancelling",
      "cancelled",
    ],
    default: "created",
    required: true,
    index: true,
  },
  jobCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  // OpenAI Batch identifiers
  openaiBatchId: {
    type: String,
    default: null,
    index: true,
  },
  inputFileId: {
    type: String,
    default: null,
  },
  outputFileId: {
    type: String,
    default: null,
  },
  errorFileId: {
    type: String,
    default: null,
  },
  submittedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  lastPolledAt: {
    type: Date,
    default: null,
  },
  pollCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  error: {
    type: String,
    default: null,
  },
  // OpenAI Batch API diagnostics (helps diagnose stuck batches - see request_counts)
  openaiRequestCounts: {
    total: { type: Number, default: null },
    completed: { type: Number, default: null },
    failed: { type: Number, default: null },
  },
  openaiInProgressAt: { type: Date, default: null },
  openaiExpiresAt: { type: Date, default: null },
  openaiCompletedAt: { type: Date, default: null },
}).add(baseSchema);

simulationBatchSchema.index({ scenarioId: 1, createdDate: -1 });
simulationBatchSchema.index({ openaiBatchId: 1, status: 1 });

simulationBatchSchema.statics.createBatch = async function (
  input,
  organizationId,
  clerkUserId
) {
  const batch = new this({
    classroomId: input.classroomId,
    scenarioId: input.scenarioId,
    status: "created",
    jobCount: input.jobCount || 0,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });
  await batch.save();
  return batch;
};

simulationBatchSchema.methods.markSubmitted = async function (data = {}) {
  this.status = "submitted";
  this.openaiBatchId = data.openaiBatchId || this.openaiBatchId;
  this.inputFileId = data.inputFileId || this.inputFileId;
  this.submittedAt = data.submittedAt || new Date();
  this.error = null;
  await this.save();
  return this;
};

simulationBatchSchema.methods.updateFromOpenAIStatus = async function (
  openaiBatch
) {
  // openaiBatch.status is expected to be one of validating/in_progress/finalizing/completed/failed/expired/cancelled
  if (openaiBatch?.status) {
    this.status = openaiBatch.status;
  }
  if (openaiBatch?.output_file_id) {
    this.outputFileId = openaiBatch.output_file_id;
  }
  if (openaiBatch?.error_file_id) {
    this.errorFileId = openaiBatch.error_file_id;
  }
  if (openaiBatch?.status === "completed") {
    this.completedAt = this.completedAt || new Date();
  }
  // Persist OpenAI diagnostics for admin monitoring (request_counts helps detect stuck batches at 0 progress)
  if (openaiBatch?.request_counts && typeof openaiBatch.request_counts === "object") {
    this.openaiRequestCounts = {
      total: openaiBatch.request_counts.total ?? null,
      completed: openaiBatch.request_counts.completed ?? null,
      failed: openaiBatch.request_counts.failed ?? null,
    };
  }
  if (openaiBatch?.in_progress_at) {
    this.openaiInProgressAt = new Date(openaiBatch.in_progress_at * 1000);
  }
  if (openaiBatch?.expires_at) {
    this.openaiExpiresAt = new Date(openaiBatch.expires_at * 1000);
  }
  if (openaiBatch?.completed_at) {
    this.openaiCompletedAt = new Date(openaiBatch.completed_at * 1000);
  }
  this.lastPolledAt = new Date();
  this.pollCount += 1;
  await this.save();
  return this;
};

simulationBatchSchema.methods.markFailed = async function (errorMessage) {
  this.status = "failed";
  this.error = errorMessage || "Batch failed";
  this.completedAt = new Date();
  await this.save();
  return this;
};

simulationBatchSchema.methods.markCancelled = async function (reason) {
  this.status = "cancelled";
  this.error = reason || "Cancelled by admin";
  this.completedAt = new Date();
  await this.save();
  return this;
};

simulationBatchSchema.statics.findInProgressByScenario = async function (
  scenarioId
) {
  return this.findOne({
    scenarioId,
    openaiBatchId: { $ne: null },
    status: {
      $in: ["submitted", "validating", "in_progress", "finalizing"],
    },
  }).sort({ createdDate: -1 });
};

/**
 * Get the most recent batch for a scenario (any status), for admin monitoring.
 */
simulationBatchSchema.statics.findLatestByScenario = async function (
  scenarioId
) {
  return this.findOne({ scenarioId })
    .sort({ createdDate: -1 })
    .lean();
};

const SimulationBatch = mongoose.model("SimulationBatch", simulationBatchSchema);

module.exports = SimulationBatch;

