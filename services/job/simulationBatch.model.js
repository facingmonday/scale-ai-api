const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const simulationBatchSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Challenge",
    required: true,
    index: true,
  },
  processingRunId: { type: String, default: null },
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
}).add(baseSchema);

simulationBatchSchema.index({ challengeId: 1, createdDate: -1 });
simulationBatchSchema.index({ challengeId: 1, processingRunId: 1, status: 1 });
simulationBatchSchema.index({ openaiBatchId: 1, status: 1 });

simulationBatchSchema.statics.createBatch = async function (
  input,
  organizationId,
  clerkUserId,
) {
  const batch = new this({
    classroomId: input.classroomId,
    challengeId: input.challengeId,
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
  openaiBatch,
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

simulationBatchSchema.methods.markCancelled = async function (reason) {
  this.status = "cancelled";
  this.error = reason || "Cancelled by admin";
  this.completedAt = new Date();
  await this.save();
  return this;
};

simulationBatchSchema.statics.findInProgressByScenario = async function (
  challengeId,
) {
  return this.findOne({
    challengeId,
    status: {
      $in: [
        "submitted",
        "validating",
        "in_progress",
        "finalizing",
        "cancelling",
      ],
    },
  }).sort({ createdDate: -1 });
};

/**
 * Cancel every non-terminal OpenAI batch for a challenge.
 * Provider-backed batches are cancelled remotely when possible. Locally
 * created batches without a provider id are still marked cancelled so they
 * cannot leave result-processing settings locked forever.
 *
 * @param {string} challengeId - Challenge ID
 * @param {string} [organizationId] - Optional tenant scope
 * @returns {Promise<{ cancelled: boolean, count?: number, openaiBatchId?: string, openaiBatchIds?: string[] }>}
 */
simulationBatchSchema.statics.cancelInProgressBatchForScenario =
  async function (challengeId, organizationId = null) {
    const openai = require("../../lib/openai");
    const query = {
      challengeId,
      status: {
        $in: [
          "created",
          "submitted",
          "validating",
          "in_progress",
          "finalizing",
          "cancelling",
        ],
      },
    };
    if (organizationId) query.organization = organizationId;
    const batches = await this.find(query).sort({ createdDate: -1 });
    if (!batches.length) {
      return { cancelled: false };
    }

    const openaiBatchIds = [];
    for (const batch of batches) {
      if (batch.openaiBatchId) {
        openaiBatchIds.push(batch.openaiBatchId);
        try {
          await openai.batches.cancel(batch.openaiBatchId);
        } catch (err) {
          console.warn(
            `OpenAI batch cancel failed for ${batch.openaiBatchId}:`,
            err.message,
          );
        }
      }
      await batch.markCancelled(
        "Cancelled by admin while replacing calculation",
      );
    }

    return {
      cancelled: true,
      count: batches.length,
      openaiBatchId: openaiBatchIds[0],
      openaiBatchIds,
    };
  };

const SimulationBatch = mongoose.model(
  "SimulationBatch",
  simulationBatchSchema,
);

module.exports = SimulationBatch;
