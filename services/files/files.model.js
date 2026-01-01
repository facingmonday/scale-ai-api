const mongoose = require("mongoose"),
  baseSchema = require("../../lib/baseSchema");

const FileSchema = new mongoose.Schema(
  {
    name: String,
    title: String,
    type: String,
    folder: {
      ref: "Folder",
      type: mongoose.Schema.Types.ObjectId,
    },
    url: String,
    width: { type: Number, required: false },
    height: { type: Number, required: false },
    html_attributions: [{ type: String }],
    photo_reference: { type: String, required: false },
    thumbnailUrl: { type: String, required: false },
    bucket: {
      type: String,
      required: true,
    },
    key: {
      type: String,
      required: true,
    },
  },
  {
    strict: false,
  }
);

// Add the base schema fields
FileSchema.add(baseSchema);

FileSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

FileSchema.set("toJSON", {
  virtuals: true,
});

module.exports = mongoose.model("File", FileSchema);
