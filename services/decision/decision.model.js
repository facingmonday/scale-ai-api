const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const Challenge = require("../challenge/challenge.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const variablePopulationPlugin = require("../../lib/variablePopulationPlugin");

const submissionSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Challenge",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  // Tracks how this decision was created (manual student decision vs automation).
  // NOTE: This is separate from createdBy/updatedBy (which may still be the student).
  generation: {
    method: {
      type: String,
      enum: ["MANUAL", "AI", "FORWARDED_PREVIOUS", "AI_FALLBACK", "DEFAULTS"],
      default: "MANUAL",
      index: true,
    },
    forwardedFromScenarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      default: null,
    },
    forwardedFromSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
      default: null,
    },
    // Arbitrary metadata for debugging/auditing (model name, reason, etc.)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  // Convenience pointer to the most recent ledger entry generated for this decision
  ledgerEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerEntry",
    default: null,
  },
  jobs: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SimulationJob",
      },
    ],
    default: [],
  },
  processingStatus: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
}).add(baseSchema);

// Apply variable population plugin
submissionSchema.plugin(variablePopulationPlugin, {
  variableValueModel: VariableValue,
  appliesTo: "decision",
  outputFormat: "valueMap",
});

// Compound indexes for performance
submissionSchema.index(
  { classroomId: 1, challengeId: 1, userId: 1 },
  { unique: true }
);
submissionSchema.index({ challengeId: 1, userId: 1 });
submissionSchema.index({ classroomId: 1, userId: 1 });
submissionSchema.index({ challengeId: 1 });
submissionSchema.index({ organization: 1, challengeId: 1 });
submissionSchema.index({ ledgerEntryId: 1 });

// Static methods - Shared utilities for decision operations

/**
 * Validate decision variables against VariableDefinition
 * @param {string} classroomId - Class ID
 * @param {Object} variables - Variables object to validate
 * @returns {Promise<Object>} Validation result
 */
submissionSchema.statics.validateSubmissionVariables = async function (
  classroomId,
  variables
) {
  return await VariableDefinition.validateValues(
    classroomId,
    "decision",
    variables
  );
};

/**
 * Check if decision exists
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @param {string} userId - Member ID
 * @returns {Promise<boolean>} True if decision exists
 */
submissionSchema.statics.submissionExists = async function (
  classroomId,
  challengeId,
  userId
) {
  const count = await this.countDocuments({ classroomId, challengeId, userId });
  return count > 0;
};

/**
 * Create a decision
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @param {string} userId - Member ID
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
 * @returns {Promise<Object>} Created decision with variables populated
 */
submissionSchema.statics.createSubmission = async function (
  classroomId,
  challengeId,
  userId,
  variables,
  organizationId,
  clerkUserId,
  createOptions = {}
) {
  // Check if decision already exists
  const exists = await this.submissionExists(classroomId, challengeId, userId);
  if (exists) {
    throw new Error("Decision already exists for this challenge");
  }

  // Validate variables
  const validation = await this.validateSubmissionVariables(
    classroomId,
    variables
  );
  if (!validation.isValid) {
    throw new Error(
      `Invalid decision variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    "decision",
    variables
  );

  // Only persist variables with active definitions (exclude soft-deleted variables)
  const variablesToSave =
    await VariableDefinition.filterVariablesByActiveDefinitions(
      classroomId,
      "decision",
      variablesWithDefaults
    );

  // Verify challenge is published and not closed
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }
  if (!challenge.isPublished) {
    throw new Error("Challenge is not published");
  }
  if (challenge.isClosed) {
    throw new Error("Challenge is closed");
  }

  // Create decision document
  const decision = new this({
    classroomId,
    challengeId,
    userId,
    submittedAt: new Date(),
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  // Optional generation metadata (defaults to MANUAL if not provided)
  if (createOptions && typeof createOptions === "object") {
    const gen = createOptions.generation;
    if (gen && typeof gen === "object") {
      decision.generation = {
        method: gen.method || undefined,
        forwardedFromScenarioId: gen.forwardedFromScenarioId || null,
        forwardedFromSubmissionId: gen.forwardedFromSubmissionId || null,
        meta: gen.meta !== undefined ? gen.meta : null,
      };
    }
  }

  await decision.save();

  // Create variable values if provided
  if (variablesToSave && Object.keys(variablesToSave).length > 0) {
    const variableEntries = Object.entries(variablesToSave);
    const variableDocs = variableEntries.map(([key, value]) => ({
      classroomId,
      appliesTo: "decision",
      ownerId: decision._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await VariableValue.insertMany(variableDocs);
    }
  }

  // Return decision with variables populated (auto-loaded via plugin)
  const createdSubmission = await this.findOne({
    classroomId,
    challengeId,
    userId,
  });
  return createdSubmission ? createdSubmission.toObject() : null;
};

/**
 * Update a decision
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @param {string} userId - Member ID
 * @param {Object} variables - Variables object
 * @param {string} organizationId - Organization ID
 * @param {string} clerkUserId - Clerk user ID for updatedBy
 * @returns {Promise<Object>} Updated decision with variables populated
 */
submissionSchema.statics.updateSubmission = async function (
  classroomId,
  challengeId,
  userId,
  variables,
  organizationId,
  clerkUserId
) {
  // Find existing decision
  const decision = await this.findOne({ classroomId, challengeId, userId });
  if (!decision) {
    throw new Error("Decision not found");
  }

  // Verify challenge is published and not closed
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found");
  }
  if (!challenge.isPublished) {
    throw new Error("Challenge is not published");
  }
  if (challenge.isClosed) {
    throw new Error("Challenge is closed");
  }

  // Validate variables
  const validation = await this.validateSubmissionVariables(
    classroomId,
    variables
  );
  if (!validation.isValid) {
    throw new Error(
      `Invalid decision variables: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Apply defaults
  const variablesWithDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    "decision",
    variables
  );

  // Only persist variables with active definitions (exclude soft-deleted variables)
  const variablesToSave =
    await VariableDefinition.filterVariablesByActiveDefinitions(
      classroomId,
      "decision",
      variablesWithDefaults
    );

  // Update decision document
  decision.updatedBy = clerkUserId;
  decision.updatedDate = new Date();
  await decision.save();

  // Delete existing variable values
  await VariableValue.deleteMany({
    classroomId,
    appliesTo: "decision",
    ownerId: decision._id,
  });

  // Create new variable values if provided
  if (variablesToSave && Object.keys(variablesToSave).length > 0) {
    const variableEntries = Object.entries(variablesToSave);
    const variableDocs = variableEntries.map(([key, value]) => ({
      classroomId,
      appliesTo: "decision",
      ownerId: decision._id,
      variableKey: key,
      value: value,
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    }));

    if (variableDocs.length > 0) {
      await VariableValue.insertMany(variableDocs);
    }
  }

  // Return decision with variables populated (auto-loaded via plugin)
  const updatedSubmission = await this.findOne({
    classroomId,
    challengeId,
    userId,
  });
  return updatedSubmission ? updatedSubmission.toObject() : null;
};


/**
* Get decisions for a challenge (normalized for AI)
* @param {string} challengeId - Challenge ID
* @returns {Promise<Array>} Array of normalized decision objects
*/
submissionSchema.statics.getSubmissionsByScenario = async function (
 challengeId
) {
 const decisions = await this.find({ challengeId })
   .populate({
     path: "userId",
     select: "_id clerkUserId firstName lastName maskedEmail",
   })
   .populate({
     path: "jobs",
     select: "_id status error attempts startedAt completedAt dryRun",
   })
   .populate({
     path: "ledgerEntryId",
     select: "_id metrics randomEvent summary",
   });

 // Use plugin's efficient batch population
 await this.populateVariablesForMany(decisions);

 // Variables are automatically included via plugin (already in array format with full definitions)
 return decisions.map((decision) => {
   const submissionObj = decision.toObject();
   // Ensure legacy decisions (created before generation metadata existed) still expose a method.
   const generation =
     submissionObj.generation && typeof submissionObj.generation === "object"
       ? {
           ...submissionObj.generation,
           method: submissionObj.generation.method || "MANUAL",
         }
       : { method: "MANUAL" };

   return {
     ...submissionObj,
     generation,
     member: decision.userId
       ? {
           _id: decision.userId._id,
           clerkUserId: decision.userId.clerkUserId,
           email: decision.userId.maskedEmail,
           firstName: decision.userId.firstName,
           lastName: decision.userId.lastName,
         }
       : null,
     variables: submissionObj.variables || [],
     submittedAt: submissionObj.submittedAt,
     jobs: submissionObj.jobs || [],
     processingStatus: submissionObj.processingStatus || "pending",
   };
 });
};

/**
* Get lightweight decision references for a challenge (for job creation/enqueue).
* This intentionally avoids populates + variable population (which are expensive and unnecessary here).
*
* @param {string} challengeId - Challenge ID
* @returns {Promise<Array<{_id: ObjectId, userId: ObjectId}>>}
*/
submissionSchema.statics.getSubmissionRefsByScenario = async function (
 challengeId
) {
 return await this.find({ challengeId }).select("_id userId").lean();
};

/**
 * Get lightweight decision references for a challenge (for job creation/enqueue).
 * This intentionally avoids populates + variable population (which are expensive and unnecessary here).
 *
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<Array<{_id: ObjectId, userId: ObjectId}>>}
 */
submissionSchema.statics.getSubmissionRefsByScenario = async function (
  challengeId
) {
  return await this.find({ challengeId }).select("_id userId").lean();
};

/**
 * Get missing decisions for a challenge
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @returns {Promise<Array>} Array of user IDs who haven't submitted (only org:member role)
 */
submissionSchema.statics.getMissingSubmissions = async function (
  classroomId,
  challengeId
) {
  const Enrollment = require("../enrollment/enrollment.model");
  const Classroom = require("../classroom/classroom.model");

  // Get classroom to access organization
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    throw new Error("Class not found");
  }

  const organizationId = classroom.organization;

  // Get all enrolled students (members) and populate with organizationMemberships
  const enrollments = await Enrollment.findByClass(classroomId).populate({
    path: "userId",
    select: "organizationMemberships",
  });

  // Filter to only include members with org:member role in this organization
  const filteredEnrollments = enrollments.filter((enrollment) => {
    const member = enrollment.userId;
    if (!member || !member.organizationMemberships) {
      return false;
    }

    // Check if member has org:member role in this organization
    const orgMembership = member.organizationMemberships.find(
      (membership) =>
        membership.organizationId.toString() === organizationId.toString() &&
        membership.role === "org:member"
    );

    return !!orgMembership;
  });

  // Extract ObjectIds from enrolled users (userId is populated, so it's an object with _id)
  const enrolledUserIds = filteredEnrollments
    .map((e) => {
      const userId = e.userId;
      // userId is populated, so it's a document object - extract the _id
      // If _id exists, use it; otherwise userId itself should be the ObjectId
      if (!userId) return null;
      return userId._id ? userId._id : userId;
    })
    .filter(Boolean); // Remove any null values

  // Get all decisions for this challenge (use lean to avoid population issues)
  const decisions = await this.find({ challengeId }).lean();
  const submittedUserIds = new Set(decisions.map((s) => s.userId.toString()));

  // Find missing user IDs (convert to string for comparison)
  const missingUserIds = enrolledUserIds.filter((userId) => {
    const userIdStr = userId.toString();
    return !submittedUserIds.has(userIdStr);
  });

  return missingUserIds;
};

/**
 * Get decision for a user and challenge
 * @param {string} classroomId - Class ID
 * @param {string} challengeId - Challenge ID
 * @param {string} userId - Member ID
 * @returns {Promise<Object|null>} Decision with variables or null
 */
submissionSchema.statics.getSubmission = async function (
  classroomId,
  challengeId,
  userId
) {
  const decision = await this.findOne({
    classroomId,
    challengeId,
    userId,
  }).populate({
    path: "jobs",
    select: "_id status error attempts startedAt completedAt dryRun",
  });
  if (!decision) {
    return null;
  }

  // Explicitly populate variables before returning (post-init hook may not complete in time)
  await this.populateVariablesForMany([decision]);
  const submissionObj = decision.toObject();
  // Ensure legacy decisions (created before generation metadata existed) still expose a method.
  submissionObj.generation =
    submissionObj.generation && typeof submissionObj.generation === "object"
      ? {
          ...submissionObj.generation,
          method: submissionObj.generation.method || "MANUAL",
        }
      : { method: "MANUAL" };
  // Ensure _id is included (should be by default, but make it explicit)
  submissionObj._id = decision._id;
  submissionObj.jobs = submissionObj.jobs || [];
  submissionObj.processingStatus = submissionObj.processingStatus || "pending";
  return submissionObj;
};

/**
 * Get all decisions for a user
 * @param {string} classroomId - Class ID
 * @param {string} userId - Member ID
 * @returns {Promise<Array>} Array of decisions with variables
 */
submissionSchema.statics.getSubmissionsByUser = async function (
  classroomId,
  userId
) {
  const decisions = await this.find({ classroomId, userId })
    .populate({
      path: "jobs",
      select: "_id status error attempts startedAt completedAt dryRun",
    })
    .sort({
      submittedAt: 1,
    });

  // Use plugin's efficient batch population
  await this.populateVariablesForMany(decisions);

  // Variables are automatically included via plugin
  return decisions.map((decision) => {
    const submissionObj = decision.toObject();
    // Ensure legacy decisions (created before generation metadata existed) still expose a method.
    submissionObj.generation =
      submissionObj.generation && typeof submissionObj.generation === "object"
        ? {
            ...submissionObj.generation,
            method: submissionObj.generation.method || "MANUAL",
          }
        : { method: "MANUAL" };
    submissionObj.jobs = submissionObj.jobs || [];
    submissionObj.processingStatus =
      submissionObj.processingStatus || "pending";
    return submissionObj;
  });
};

// Instance methods

/**
 * Populate variables for this decision instance
 * Loads and caches variables so they're available in toObject()/toJSON()
 * @returns {Promise<this>} This decision instance with variables populated
 */
submissionSchema.methods.populateVariables = async function () {
  // Load variables (will be cached by the plugin)
  await this._loadVariables();
  return this;
};

/**
 * Get variables for this decision instance
 * Uses cached variables if available, otherwise loads them
 * @returns {Promise<Object>} Variables object
 */
submissionSchema.methods.getVariables = async function () {
  // Use plugin's cached variables or load them
  return await this._loadVariables();
};

/**
 * Check if decision can be edited
 * @returns {boolean} Always false - decisions are immutable
 */
submissionSchema.methods.canEdit = function () {
  return false; // Decisions are immutable after creation
};

/**
 * Add a job to this decision
 * @param {string} jobId - Job ID to add
 * @returns {Promise<this>} Updated decision
 */
submissionSchema.methods.addJob = async function (jobId) {
  if (!this.jobs.includes(jobId)) {
    this.jobs.push(jobId);
    // Set status to processing if not already completed
    if (this.processingStatus === "pending") {
      this.processingStatus = "processing";
    }
    await this.save();
  }
  return this;
};

/**
 * Update processing status based on job status
 * @param {string} jobStatus - Job status ("completed" or "failed")
 * @returns {Promise<this>} Updated decision
 */
submissionSchema.methods.updateProcessingStatus = async function (jobStatus) {
  if (jobStatus === "completed") {
    this.processingStatus = "completed";
  } else if (jobStatus === "failed") {
    // Only set to failed if not already completed (in case of retries)
    if (this.processingStatus !== "completed") {
      this.processingStatus = "failed";
    }
  }
  await this.save();
  return this;
};

const Decision = mongoose.model("Decision", submissionSchema);

module.exports = Decision;
