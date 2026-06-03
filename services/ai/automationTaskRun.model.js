const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const automationTaskRunSchema = new mongoose.Schema({
  automationTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AutomationTask",
    required: true,
    index: true,
  },
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
  decisionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Decision",
    required: false,
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: false,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "running", "completed", "failed"],
    default: "pending",
    required: true,
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  error: {
    type: String,
    default: null,
  },
  runTime: {
    type: Date,
    default: Date.now,
  },
}).add(baseSchema);

module.exports = mongoose.model("AutomationTaskRun", automationTaskRunSchema);
