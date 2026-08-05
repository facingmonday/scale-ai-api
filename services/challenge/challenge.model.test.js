const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const Challenge = require("./challenge.model");
const Outcome = require("../outcome/outcome.model");

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

test("challenge exports lifecycle statics", () => {
  assert.equal(typeof Challenge.createScenario, "function");
  assert.equal(typeof Challenge.publishDueScenarios, "function");
  assert.equal(typeof Challenge.closeDueSubmissions, "function");
  assert.equal(typeof Challenge.processDueOutcomes, "function");
});
