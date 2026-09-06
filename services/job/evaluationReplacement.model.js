const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const eventSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    at: { type: Date, default: Date.now, required: true },
    actor: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const evaluationReplacementSchema = new mongoose.Schema({
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
  decisionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Decision",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SimulationJob",
    default: null,
  },
  publishedLedgerEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LedgerEntry",
    required: true,
  },
  state: {
    type: String,
    enum: ["queued", "processing", "draft", "failed", "published", "discarded"],
    default: "queued",
    required: true,
  },
  // Present only while a replacement is actionable. The unique sparse index
  // makes rerun requests idempotent without constraining retained history.
  activeKey: { type: String, default: undefined },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  originalResult: { type: mongoose.Schema.Types.Mixed, required: true },
  error: { type: String, default: null },
  publishedAt: { type: Date, default: null },
  discardedAt: { type: Date, default: null },
  notifiedAt: { type: Date, default: null },
  events: { type: [eventSchema], default: [] },
}).add(baseSchema);

evaluationReplacementSchema.index(
  { activeKey: 1 },
  { unique: true, sparse: true },
);
evaluationReplacementSchema.index({
  organization: 1,
  challengeId: 1,
  userId: 1,
  createdDate: -1,
});

evaluationReplacementSchema.methods.record = function (
  action,
  actor,
  details = null,
) {
  this.events.push({ action, actor: actor || null, details });
};

module.exports = mongoose.model(
  "EvaluationReplacement",
  evaluationReplacementSchema,
);
