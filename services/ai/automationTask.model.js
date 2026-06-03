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
    enum: ["AFTER_CHALLENGE_CREATED", "AFTER_STUDENT_SUBMISSION", "AFTER_CHALLENGE_CLOSED"],
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

module.exports = mongoose.model("AutomationTask", automationTaskSchema);
