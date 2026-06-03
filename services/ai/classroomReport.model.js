const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const classroomReportSchema = new mongoose.Schema({
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
  reportType: {
    type: String,
    enum: ["NIGHTLY_LESSON_PREP", "CUSTOM_TASK_OUTPUT"],
    default: "NIGHTLY_LESSON_PREP",
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}).add(baseSchema);

module.exports = mongoose.model("ClassroomReport", classroomReportSchema);
