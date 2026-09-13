const mongoose = require("mongoose");
const Notification = require("../notifications/notifications.model");
const SimulationJob = require("../job/job.model");
const Challenge = require("../challenge/challenge.model");

const ACTION_LABELS = {
  submit: "Submission saved",
  update: "Submission updated",
  processing_started: "Calculation started",
  processing_completed: "Calculation completed",
  processing_failed: "Calculation unsuccessful",
  retry_queued: "Calculation retry requested",
};

// Read existing receipts and recorded job events only. Never infer a student
// submission from a Decision's presence, timestamps, or generation method.
function buildPipeline({ organizationId, classroomId, studentId, offset, limit }) {
  const organization = new mongoose.Types.ObjectId(organizationId);
  const classroom = new mongoose.Types.ObjectId(classroomId);
  const student = new mongoose.Types.ObjectId(studentId);
  return [
    { $match: {
      organization, "recipient.id": student,
      "decisionReceipt.classroomId": classroom,
      templateSlug: "decision-receipt",
      "decisionReceipt.kind": { $in: ["submit", "update"] },
      "decisionReceipt.savedAt": { $type: "date" },
    } },
    { $project: {
      _id: 0,
      id: { $concat: ["receipt:", { $toString: "$_id" }] },
      at: "$decisionReceipt.savedAt", action: "$decisionReceipt.kind",
      challengeId: "$decisionReceipt.challengeId",
      challengeTitle: "$templateData.challenge.title",
      answers: {
        variables: "$templateData.variables",
        challengeVariableAnswers: "$templateData.challengeVariableAnswers",
        labels: "$templateData.labels",
      },
    } },
    { $unionWith: {
      coll: SimulationJob.collection.name,
      pipeline: [
        { $match: {
          organization, classroomId: classroom, userId: student,
          dryRun: { $ne: true }, purpose: { $ne: "replacement" },
        } },
        { $unwind: { path: "$history", includeArrayIndex: "eventIndex" } },
        { $match: {
          "history.action": { $in: Object.keys(ACTION_LABELS).filter((key) => !["submit", "update"].includes(key)) },
          "history.at": { $type: "date" },
        } },
        // Explicit projection keeps provider errors, prompts, hidden outcome
        // notes and unreleased result metrics out of both activity endpoints.
        { $project: {
          _id: 0,
          id: { $concat: ["job:", { $toString: "$_id" }, ":", { $toString: "$eventIndex" }] },
          at: "$history.at", action: "$history.action", challengeId: 1,
        } },
      ],
    } },
    { $sort: { at: -1, id: -1 } },
    { $skip: offset },
    { $limit: limit + 1 },
    { $lookup: {
      from: Challenge.collection.name,
      let: { challengeId: "$challengeId" },
      pipeline: [
        { $match: { organization, classroomId: classroom, $expr: { $eq: ["$_id", "$$challengeId"] } } },
        { $project: { _id: 0, title: 1 } },
      ],
      as: "challenge",
    } },
    { $set: { challengeTitle: { $ifNull: ["$challengeTitle", { $arrayElemAt: ["$challenge.title", 0] }] } } },
    { $unset: "challenge" },
  ];
}

async function getActivity(options) {
  const records = await Notification.aggregate(buildPipeline(options)).option({ maxTimeMS: 10000 });
  return {
    data: records.slice(0, options.limit).map((event) => ({
      id: event.id,
      at: event.at,
      action: event.action,
      challengeId: event.challengeId,
      title: ACTION_LABELS[event.action],
      challengeTitle: event.challengeTitle || "Challenge no longer available",
      ...(event.answers ? { answers: {
        variables: event.answers.variables || {},
        challengeVariableAnswers: event.answers.challengeVariableAnswers || {},
        labels: event.answers.labels || {},
      } } : {}),
    })),
    hasMore: records.length > options.limit,
    offset: options.offset,
    limit: options.limit,
  };
}

module.exports = { getActivity, buildPipeline };
