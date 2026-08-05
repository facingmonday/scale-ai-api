const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const automationTaskSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  trigger: {
    type: String,
    enum: ["AFTER_CHALLENGE_CREATED", "AFTER_STUDENT_SUBMISSION", "AFTER_CHALLENGE_CLOSED", "AFTER_CHALLENGE_CLOSED_PER_STUDENT"],
    required: true,
    index: true,
  },
  promptTemplate: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  actionType: {
    type: String,
    enum: ["GENERATE_SLIDES", "GENERATE_REPORT", "SEND_NOTIFICATION", "CUSTOM_PROMPT"],
    default: "CUSTOM_PROMPT",
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}).add(baseSchema);

/**
 * Trigger automation tasks of a specific lifecycle type
 * @param {string} triggerType - The trigger enum value
 * @param {Object} data - Payload parameters (classroomId, challengeId, etc.)
 */
automationTaskSchema.statics.trigger = async function (triggerType, data) {
  try {
    const { enqueueAutomationTaskRun } = require("../../lib/queues/automation-task-worker");
    const AutomationTaskRun = require("./automationTaskRun.model");
    const { classroomId, challengeId, decisionId, userId, organizationId, clerkUserId } = data;
    if (!classroomId || !challengeId) {
      throw new Error("classroomId and challengeId are required to trigger automation tasks");
    }

    console.log(`📡 Triggering tasks for classroom: ${classroomId}, challenge: ${challengeId}, event: ${triggerType}`);

    // Find all active automation tasks for this classroom and trigger
    // If triggerType is AFTER_CHALLENGE_CLOSED, we also find AFTER_CHALLENGE_CLOSED_PER_STUDENT tasks.
    const triggerTypes = [triggerType];
    if (triggerType === "AFTER_CHALLENGE_CLOSED") {
      triggerTypes.push("AFTER_CHALLENGE_CLOSED_PER_STUDENT");
    }

    const activeTasks = await this.find({
      classroomId,
      trigger: { $in: triggerTypes },
      isActive: true,
    }).lean();

    if (activeTasks.length === 0) {
      console.log(`No active automation tasks configured for event "${triggerType}" in classroom ${classroomId}`);
      return { success: true, count: 0 };
    }

    console.log(`Found ${activeTasks.length} active automation tasks to process.`);

    const enqueuedRuns = [];

    for (const task of activeTasks) {
      if (task.trigger === "AFTER_CHALLENGE_CLOSED_PER_STUDENT") {
        const Decision = require("../decision/decision.model");
        const decisions = await Decision.find({ challengeId }).lean();
        for (const dec of decisions) {
          const run = new AutomationTaskRun({
            automationTaskId: task._id,
            classroomId,
            challengeId,
            decisionId: dec._id,
            userId: dec.userId,
            status: "pending",
            organization: organizationId || task.organization,
            createdBy: clerkUserId || "system",
            updatedBy: clerkUserId || "system",
          });

          await run.save();

          // Enqueue Bull queue job
          await enqueueAutomationTaskRun(run._id);
          enqueuedRuns.push(run._id);
        }
      } else {
        // Create an AutomationTaskRun audit log in 'pending' status
        const run = new AutomationTaskRun({
          automationTaskId: task._id,
          classroomId,
          challengeId,
          decisionId: decisionId || null,
          userId: userId || null,
          status: "pending",
          organization: organizationId || task.organization,
          createdBy: clerkUserId || "system",
          updatedBy: clerkUserId || "system",
        });

        await run.save();

        // Enqueue Bull queue job
        await enqueueAutomationTaskRun(run._id);
        enqueuedRuns.push(run._id);
      }
    }

    return { success: true, count: enqueuedRuns.length, runIds: enqueuedRuns };
  } catch (error) {
    console.error(`Error in AutomationTask.trigger for ${triggerType}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = mongoose.model("AutomationTask", automationTaskSchema);