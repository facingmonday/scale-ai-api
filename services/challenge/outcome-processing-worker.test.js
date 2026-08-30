const test = require("node:test");
const assert = require("node:assert/strict");

const {
  markOutcomeProcessingFailed,
  getMissingSubmissionSettings,
} = require("../../lib/queues/outcome-processing-worker");

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
