const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const FileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["image", "video", "audio", "document", "report", "other"],
      default: "other",
    },
    url: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    bucket: {
      type: String,
    },
    key: {
      type: String,
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    visibility: {
      type: String,
      enum: ["teachers", "everyone", "student"],
      default: "everyone",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
      index: true,
    },
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      default: null,
      index: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      default: null,
      index: true,
    },
    reportType: {
      type: String,
      default: null,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    strict: false,
  }
);

FileSchema.add(baseSchema);

FileSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

FileSchema.set("toJSON", {
  virtuals: true,
});

module.exports = mongoose.models.File || mongoose.model("File", FileSchema);
// Export FileSchema for reuse
module.exports.FileSchema = FileSchema;
