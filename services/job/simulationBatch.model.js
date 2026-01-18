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

const SimulationBatch = mongoose.model("SimulationBatch", simulationBatchSchema);

module.exports = SimulationBatch;

