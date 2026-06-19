const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const Challenge = require("../services/challenge/challenge.model");
const Outcome = require("../services/outcome/outcome.model");

test("scheduled challenges default to full automation metadata when configured", async () => {
  const challenge = new Challenge({
    classroomId: "507f1f77bcf86cd799439011",
    title: "Week 3",
    publishAt: new Date("2026-09-01T15:00:00.000Z"),
    submissionDeadlineAt: new Date("2026-09-08T15:00:00.000Z"),
    automationMode: "FULL",
    automationStatus: "SCHEDULED",
    missingSubmissionPolicy: "FORWARD_PREVIOUS",
    punishAbsentStudents: "low",
    organization: "507f1f77bcf86cd799439012",
    createdBy: "test",
    updatedBy: "test",
  });

  await challenge.validate();

  assert.equal(challenge.automationMode, "FULL");
  assert.equal(challenge.automationStatus, "SCHEDULED");
  assert.equal(challenge.missingSubmissionPolicy, "FORWARD_PREVIOUS");
  assert.equal(challenge.punishAbsentStudents, "low");
});

test("challenge outcome drafts preserve hidden notes and skip policy", async () => {
  const outcome = new Outcome({
    challengeId: "507f1f77bcf86cd799439013",
    notes: "Public result context",
    hiddenNotes: "Instructor-only automation context",
    autoGenerateSubmissionsOnOutcome: "SKIP",
    punishAbsentStudents: "none",
    organization: "507f1f77bcf86cd799439012",
    createdBy: "test",
    updatedBy: "test",
  });

  await outcome.validate();

  assert.equal(outcome.hiddenNotes, "Instructor-only automation context");
  assert.equal(outcome.autoGenerateSubmissionsOnOutcome, "SKIP");
});

test("new challenge automation fields are validated successfully", async () => {
  const challenge = new Challenge({
    classroomId: "507f1f77bcf86cd799439011",
    title: "Week 4",
    publishAt: new Date(),
    submissionDeadlineAt: new Date(),
    closeSubmissionsAt: new Date(),
    processAt: new Date(),
    feedbackReleaseAt: new Date(),
    feedbackReleaseMode: "DELAYED",
    isFeedbackReleased: false,
    isLockedForStudents: true,
    allowLateSubmissions: true,
    lateSubmissionPolicy: { penaltyPercentPerDay: 5 },
    organization: "507f1f77bcf86cd799439012",
    createdBy: "test",
    updatedBy: "test",
  });

  await challenge.validate();

  assert.equal(challenge.feedbackReleaseMode, "DELAYED");
  assert.equal(challenge.isLockedForStudents, true);
  assert.equal(challenge.allowLateSubmissions, true);
  assert.equal(challenge.lateSubmissionPolicy.penaltyPercentPerDay, 5);
});

const mongoose = require("mongoose");

async function connectDb() {
  if (mongoose.connection.readyState === 0) {
    let uri = process.env.MONGO_URL || process.env.MONGO_URI;
    if (!uri && process.env.MONGO_SCHEME) {
      uri = `${process.env.MONGO_SCHEME}://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOSTNAME}/${process.env.MONGO_DB}?authSource=admin`;
    }
    if (!uri) {
      uri = "mongodb://localhost:27017/scale-ai-api";
    }
    await mongoose.connect(uri);
  }
}

test("createScenario defaults closeSubmissionsAt and processAt to submissionDeadlineAt", async () => {
  await connectDb();
  
  const classroomId = new mongoose.Types.ObjectId();
  const organizationId = new mongoose.Types.ObjectId();
  const clerkUserId = "test-user-123";
  const deadline = new Date("2026-09-08T15:00:00.000Z");

  const challenge = await Challenge.createScenario(
    classroomId,
    {
      title: "Test Default Dates Challenge",
      description: "Testing default dates",
      submissionDeadlineAt: deadline,
      automationMode: "FULL",
    },
    organizationId,
    clerkUserId
  );

  try {
    assert.ok(challenge);
    assert.equal(challenge.closeSubmissionsAt.toISOString(), deadline.toISOString());
    assert.equal(challenge.processAt.toISOString(), deadline.toISOString());
  } finally {
    await Challenge.deleteOne({ _id: challenge._id });
    await mongoose.connection.close();
  }
});

