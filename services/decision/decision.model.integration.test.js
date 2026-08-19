const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const Challenge = require("../challenge/challenge.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const Decision = require("./decision.model");

test("create and update persist challenge variable answers on the student decision", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });
  await clearCollections();

  const classroomId = new mongoose.Types.ObjectId();
  const organizationId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const clerkUserId = "student-test-user";

  const createdChallenge = await Challenge.createScenario(
    classroomId,
    { title: "Student questions", automationMode: "MANUAL" },
    organizationId,
    "teacher-test-user"
  );
  const challengeId = createdChallenge._id;
  await Challenge.updateOne(
    { _id: challengeId },
    { $set: { isPublished: true } }
  );

  const commonDefinitionFields = {
    classroomId,
    organization: organizationId,
    dataType: "number",
    inputType: "slider",
    min: 0,
    max: 100,
    required: true,
    isActive: true,
    createdBy: "teacher-test-user",
    updatedBy: "teacher-test-user",
  };

  await VariableDefinition.create({
    ...commonDefinitionFields,
    challengeId,
    key: "challenge-question",
    label: "Challenge question",
    appliesTo: "challenge",
    defaultValue: 25,
  });
  await VariableDefinition.create({
    ...commonDefinitionFields,
    challengeId: null,
    key: "recurring-decision",
    label: "Recurring decision",
    appliesTo: "decision",
    defaultValue: 50,
  });

  const createdDecision = await Decision.createSubmission(
    classroomId,
    challengeId,
    userId,
    { "recurring-decision": 60 },
    organizationId,
    clerkUserId,
    { challengeVariableAnswers: { "challenge-question": 40 } }
  );

  assert.deepEqual(createdDecision.challengeVariableAnswers, {
    "challenge-question": 40,
  });

  const persistedCreate = await Decision.findById(createdDecision._id).lean();
  assert.deepEqual(persistedCreate.challengeVariableAnswers, {
    "challenge-question": 40,
  });

  await Decision.updateSubmission(
    classroomId,
    challengeId,
    userId,
    { "recurring-decision": 65 },
    organizationId,
    clerkUserId,
    { challengeVariableAnswers: { "challenge-question": 75 } }
  );

  const persistedUpdate = await Decision.findById(createdDecision._id).lean();
  assert.deepEqual(persistedUpdate.challengeVariableAnswers, {
    "challenge-question": 75,
  });
});
