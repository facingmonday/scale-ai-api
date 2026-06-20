const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const TagSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      index: true,
    },
    description: String,
    color: {
      type: String,
      default: "#808080",
    },
    defaultImage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: false,
    },
    type: {
      type: String,
      enum: ["file", "classroom", "tag"],
      default: "tag",
    },
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      default: null,
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

// Compound indexes to ensure unique slug per classroom or per organization
TagSchema.index({ classroomId: 1, slug: 1 }, { 
  unique: true, 
  partialIndexExpression: { classroomId: { $type: "objectId" } } 
});
TagSchema.index({ organization: 1, slug: 1 }, { 
  unique: true, 
  partialIndexExpression: { classroomId: null } 
});

TagSchema.add(baseSchema);

TagSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

TagSchema.set("toJSON", {
  virtuals: true,
});

module.exports = mongoose.model("Tag", TagSchema);
