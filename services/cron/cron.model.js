const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const CronJobSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    workerType: {
      type: String,
      required: true,
      enum: ["ticket-reminder", "email-digest", "cart-cleanup"], // Add more as needed
    },
    schedule: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          // Basic cron validation - should be 5 parts (minute hour day month dow)
          const parts = v.trim().split(/\s+/);
          return parts.length === 5;
        },
        message:
          "Schedule must be a valid cron expression (5 parts: minute hour day month dow)",
      },
    },
    timezone: {
      type: String,
      default: "America/Chicago", // CST
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: function () {
        // Organization is required only for non-system jobs
        return !this.isSystemJob;
      },
    },
    lastRun: {
      type: Date,
    },
    nextRun: {
      type: Date,
    },
    runCount: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    lastSuccess: {
      type: Date,
    },
    lastError: {
      type: Date,
    },
    lastErrorMessage: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // For system-wide jobs that don't need organization
    isSystemJob: {
      type: Boolean,
      default: false,
    },
  },
  {
    strict: false,
  }
);

// Add base schema fields manually, excluding organization
CronJobSchema.add({
  createdBy: {
    type: String,
    required: true,
  },
  createdDate: Date,
  updatedBy: {
    type: String,
    required: true,
  },
  updatedDate: Date,
});

CronJobSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

CronJobSchema.set("toJSON", {
  virtuals: true,
});

// Lease fields for distributed locking (single-run across instances)
CronJobSchema.add({
  leaseOwner: {
    type: String,
    default: null,
  },
  leaseExpiresAt: {
    type: Date,
    default: null,
    index: true,
  },
});

/**
 * Try to acquire a lease for this cron job. Returns true if acquired.
 * The lease expires automatically at leaseExpiresAt to avoid deadlocks.
 */
CronJobSchema.methods.tryAcquireLease = async function (owner, ttlMs) {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + Math.max(1, ttlMs));

  const acquired = await this.model("CronJob").findOneAndUpdate(
    {
      _id: this._id,
      $or: [
        { leaseExpiresAt: { $exists: false } },
        { leaseExpiresAt: null },
        { leaseExpiresAt: { $lte: now } },
        { leaseOwner: owner },
      ],
    },
    { $set: { leaseOwner: owner, leaseExpiresAt: leaseUntil } },
    { new: true }
  );

  return Boolean(acquired);
};

/**
 * Release the lease if owned by the provided owner
 */
CronJobSchema.methods.releaseLease = async function (owner) {
  await this.model("CronJob").findOneAndUpdate(
    { _id: this._id, leaseOwner: owner },
    { $set: { leaseOwner: null, leaseExpiresAt: null } }
  );
};

// Static method to record job execution
CronJobSchema.statics.recordExecution = async function (
  jobId,
  success,
  errorMessage = null
) {
  const updateFields = {
    lastRun: new Date(),
    $inc: { runCount: 1 },
  };

  if (success) {
    updateFields.lastSuccess = new Date();
    updateFields.$inc.successCount = 1;
  } else {
    updateFields.lastError = new Date();
    updateFields.lastErrorMessage = errorMessage;
    updateFields.$inc.errorCount = 1;
  }

  await this.findByIdAndUpdate(jobId, updateFields);
};

// Instance method to mark job as started
CronJobSchema.methods.markStarted = async function () {
  this.lastRun = new Date();
  this.runCount = (this.runCount || 0) + 1;
  await this.save();
};

// Instance method to mark job as completed
CronJobSchema.methods.markCompleted = async function (
  success,
  errorMessage = null
) {
  if (success) {
    this.lastSuccess = new Date();
    this.successCount = (this.successCount || 0) + 1;
    this.lastErrorMessage = null; // Clear any previous error
  } else {
    this.lastError = new Date();
    this.lastErrorMessage = errorMessage;
    this.errorCount = (this.errorCount || 0) + 1;
  }
  await this.save();
};

module.exports = mongoose.model("CronJob", CronJobSchema);
