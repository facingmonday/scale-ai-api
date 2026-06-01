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

