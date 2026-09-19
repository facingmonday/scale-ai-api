const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");
const { validPoints } = require("../../lib/gradingSettings");

const changeSchema = new mongoose.Schema(
  {
    revision: { type: Number, required: true },
    mode: String,
    points: { type: Number, default: null },
    excluded: Boolean,
    reason: { type: String, required: true, maxlength: 2000 },
    actor: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

function gradingSchema(fields, key) {
  const schema = new mongoose.Schema({
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: true,
    },
    ...fields,
    reason: { type: String, required: true, maxlength: 2000 },
    revision: { type: Number, required: true, min: 1 },
    history: { type: [changeSchema], select: false, default: [] },
  }).add(baseSchema);
  schema.index(
    { organization: 1, classroomId: 1, challengeId: 1, ...key },
    { unique: true },
  );
  return schema;
}

const adjustmentSchema = gradingSchema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    mode: {
      type: String,
      enum: ["AUTOMATIC", "POINTS", "EXCUSED"],
      required: true,
    },
    points: {
      type: Number,
      default: null,
      validate: (value) => value === null || validPoints(value),
    },
  },
  { userId: 1 },
);

const exclusionSchema = gradingSchema(
  { excluded: { type: Boolean, required: true } },
  {},
);

module.exports = {
  GradeAdjustment: mongoose.model("GradeAdjustment", adjustmentSchema),
  GradeExclusion: mongoose.model("GradeExclusion", exclusionSchema),
};
