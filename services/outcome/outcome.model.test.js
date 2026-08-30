const test = require("node:test");
const assert = require("node:assert/strict");

const Outcome = require("./outcome.model");

test("challenge outcome drafts only store shared result context", async () => {
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
  assert.equal(outcome.autoGenerateSubmissionsOnOutcome, undefined);
  assert.equal(outcome.punishAbsentStudents, undefined);
});
