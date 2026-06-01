const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const chatMessageSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
    index: true,
  },
  role: {
    type: String,
    required: true,
    enum: ["user", "model"], // 'user' for student/teacher, 'model' for the AI assistant response
  },
  content: {
    type: String,
    required: true,
  },
}).add(baseSchema);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
