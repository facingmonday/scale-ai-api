const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const FolderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    path: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["file", "content", "template", "other"],
      default: "file",
    },
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    strict: false,
  }
);

FolderSchema.add(baseSchema);

FolderSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

FolderSchema.set("toJSON", {
  virtuals: true,
});

module.exports = mongoose.model("Folder", FolderSchema);
