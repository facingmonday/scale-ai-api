const test = require("node:test");
const assert = require("node:assert/strict");

const {
  markOutcomeProcessingFailed,
  getMissingSubmissionSettings,
  processOutcomeProcessingJob,
} = require("../../lib/queues/outcome-processing-worker");
const mongoose = require("mongoose");
const Challenge = require("./challenge.model");
const Outcome = require("../outcome/outcome.model");
const JobService = require("../job/lib/jobService");
const classroomReadinessService = require("../classroom/classroomReadiness.service");

test("outcome processing reads missing-decision settings from the challenge", () => {
  assert.deepEqual(
    getMissingSubmissionSettings({
      missingSubmissionPolicy: "FORWARD_PREVIOUS",
      punishAbsentStudents: "medium",
      autoGenerateSubmissionsOnOutcome: "USE_DEFAULTS",
    }),
    { mode: "FORWARD_PREVIOUS", punishment: "medium" }
  );

  assert.deepEqual(getMissingSubmissionSettings({}), {
    mode: "SKIP",
    punishment: "none",
  });
});

test("outcome processing exits when its queued run was cancelled", async (t) => {
  const originals = {
    connect: mongoose.connect,
    findOne: Challenge.findOne,
    exists: Challenge.exists,
  };
  t.after(() => {
    mongoose.connect = originals.connect;
    Challenge.findOne = originals.findOne;
    Challenge.exists = originals.exists;
  });

  mongoose.connect = async () => {};
  Challenge.findOne = async () => ({
    _id: "challenge-id",
    organization: "organization-id",
  });
  Challenge.exists = async () => true;

  const result = await processOutcomeProcessingJob({
    timestamp: Date.now() - 1_000,
    data: {
      challengeId: "challenge-id",
      organizationId: "organization-id",
      clerkUserId: "teacher-id",
    },
  });

  assert.deepEqual(result, {
    success: true,
    cancelled: true,
    challengeId: "challenge-id",
  });
});

test("outcome processing only marks a challenge failed after the final attempt", async () => {
  const updates = [];
  const ChallengeModel = {
    updateOne: async (...args) => {
      updates.push(args);
    },
  };
  const job = {
    data: { challengeId: "507f1f77bcf86cd799439011" },
    attemptsMade: 2,
    opts: { attempts: 3 },
  };

  const markedBeforeFinalAttempt = await markOutcomeProcessingFailed(
    job,
    new Error("temporary"),
    ChallengeModel
  );
  assert.equal(markedBeforeFinalAttempt, false);
  assert.equal(updates.length, 0);

  job.attemptsMade = 3;
  const markedAfterFinalAttempt = await markOutcomeProcessingFailed(
    job,
    new Error("permanent failure"),
    ChallengeModel
  );

  assert.equal(markedAfterFinalAttempt, true);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0][0], {
    _id: "507f1f77bcf86cd799439011",
    isClosed: false,
  });
  assert.equal(updates[0][1].$set.automationStatus, "FAILED");
  assert.equal(updates[0][1].$set.automationError, "permanent failure");
  assert.ok(updates[0][1].$set.automationLastCheckedAt instanceof Date);
});

test("automated outcome processing cannot bypass readiness", async (t) => {
  const originals = {
    connect: mongoose.connect,
    findOne: Challenge.findOne,
    exists: Challenge.exists,
    getOutcomeByScenario: Outcome.getOutcomeByScenario,
    createJobsForScenario: JobService.createJobsForScenario,
    assertClassroomReady: classroomReadinessService.assertClassroomReady,
  };
  t.after(() => {
    mongoose.connect = originals.connect;
    Challenge.findOne = originals.findOne;
    Challenge.exists = originals.exists;
    Outcome.getOutcomeByScenario = originals.getOutcomeByScenario;
    JobService.createJobsForScenario = originals.createJobsForScenario;
    classroomReadinessService.assertClassroomReady = originals.assertClassroomReady;
  });

  mongoose.connect = async () => {};
  Challenge.findOne = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    isClosed: false,
    automationMode: "MANUAL",
    missingSubmissionPolicy: "SKIP",
    punishAbsentStudents: "none",
  });
  Challenge.exists = async () => false;
  Outcome.getOutcomeByScenario = async () => ({ _id: "outcome-id" });
  let jobsCreated = 0;
  JobService.createJobsForScenario = async () => {
    jobsCreated += 1;
    return [];
  };
  classroomReadinessService.assertClassroomReady = async (input) => {
    assert.equal(input.operation, "process");
    throw new Error("automated readiness blocked");
  };

  await assert.rejects(
    processOutcomeProcessingJob({
      data: {
        challengeId: "challenge-id",
        organizationId: "organization-id",
        clerkUserId: "teacher-id",
      },
    }),
    /automated readiness blocked/,
  );
  assert.equal(jobsCreated, 0);
});
