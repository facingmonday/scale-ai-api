const test = require("node:test");
const assert = require("node:assert/strict");
const { setupTestDb, teardownTestDb, mongoose } = require("../../test/helpers/db");
const Challenge = require("../challenge/challenge.model");
const ChallengeEmail = require("../challenge/challengeEmail.model");
const { getCalendarReminders } = require("./classroomCalendar.service");

test("calendar exposes only pending scheduled reminders from this classroom and organization", async (t) => {
  await setupTestDb();
  t.after(teardownTestDb);
  const id = () => new mongoose.Types.ObjectId();
  const classroomId = id();
  const organizationId = id();
  const challengeId = id();
  const otherChallenge = id();
  await Challenge.collection.insertMany([
    { _id: challengeId, classroomId, organization: organizationId },
    { _id: otherChallenge, classroomId: id(), organization: organizationId },
  ]);
  const base = { challengeId, organization: organizationId, kind: "scheduled", sendAt: new Date("2026-09-16") };
  await ChallengeEmail.collection.insertMany([
    ...["scheduled", "dispatched", "cancelled", "skipped", "failed"].map((status) => ({ ...base, requestKey: status, status, recipients: [id()], error: "private" })),
    { ...base, challengeId: otherChallenge, requestKey: "other-class", status: "scheduled" },
    { ...base, organization: id(), requestKey: "other-org", status: "scheduled" },
    { ...base, kind: "manual", requestKey: "manual", status: "scheduled" },
  ]);
  const result = await getCalendarReminders({ classroomId, organizationId });
  assert.equal(result.length, 1);
  assert.equal(String(result[0].challengeId), String(challengeId));
  assert.deepEqual(Object.keys(result[0]).sort(), ["_id", "challengeId", "sendAt"]);
  assert.deepEqual(await getCalendarReminders({ classroomId, organizationId: id() }), []);
});
