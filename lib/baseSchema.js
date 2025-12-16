const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

/**
 * Base schema that contains common fields for all models
 * - createdDate/updatedDate timestamps
 * - createdBy/updatedBy Clerk user IDs
 * - organization reference to local Organization document
 */
const baseSchema = new Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdDate: Date,
    updatedBy: {
      type: String,
      required: true,
    },
    updatedDate: Date,
  },
  {
    timestamps: {
      createdAt: "createdDate",
      updatedAt: "updatedDate",
    },
  }
);

module.exports = baseSchema;
