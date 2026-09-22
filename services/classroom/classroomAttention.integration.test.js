const test = require("node:test");
const assert = require("node:assert/strict");
const { setupTestDb, teardownTestDb, mongoose } = require("../../test/helpers/db");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const Profile = require("../profile/profile.model");
const SeatClaim = require("../licensing/seatClaim.model");
const { getClassroomAttention } = require("./classroomAttention.service");

test("attention report scopes every source and checks only five published, past-due challenges", async (t) => {
  await setupTestDb();
  t.after(teardownTestDb);
  const id = () => new mongoose.Types.ObjectId();
  const organizationId = id();
  const classroomId = id();
  const otherOrganization = id();
  const otherClassroom = id();
  const scope = { classroomId, organization: organizationId };
  const now = new Date("2026-09-15T12:00:00Z");
  const studentId = id();
  const goodStudentId = id();
  const removedStudentId = id();
  const teacherId = id();
  const formerMemberId = id();
  const joinedAt = new Date("2026-09-01");
  // Raw fixtures avoid unrelated save hooks, email queues and external providers.
  await Member.collection.insertMany([studentId, goodStudentId, removedStudentId, teacherId, formerMemberId].map((userId) => ({
    _id: userId, firstName: String(userId), clerkUserId: String(userId),
    organizationMemberships: [{ organizationId: userId === formerMemberId ? otherOrganization : organizationId, role: userId === teacherId ? "org:admin" : "org:member" }],
  })));
  await Enrollment.collection.insertMany([studentId, goodStudentId, removedStudentId, teacherId, formerMemberId].map((userId) => ({
    ...scope, userId, role: "member", isRemoved: userId === removedStudentId, joinedAt,
  })));
  const challengeDocs = Array.from({ length: 6 }, (_, index) => ({
    ...scope, _id: id(), title: `Challenge ${index}`, isPublished: true,
    submissionDeadlineAt: new Date(`2026-09-${String(index + 8).padStart(2, "0")}`),
  }));
  await Challenge.collection.insertMany([
    ...challengeDocs,
    { ...scope, title: "Draft", isPublished: false, submissionDeadlineAt: new Date("2026-09-15") },
    { ...scope, title: "Future", isPublished: true, submissionDeadlineAt: new Date("2026-09-16") },
    { ...scope, title: "Not started", isPublished: true, publishAt: new Date("2026-09-16"), submissionDeadlineAt: new Date("2026-09-15") },
    { ...scope, title: "No known deadline", isPublished: true, isClosed: true },
    { ...scope, organization: otherOrganization, title: "Other org", isPublished: true, submissionDeadlineAt: new Date("2026-09-15") },
    { ...scope, classroomId: otherClassroom, title: "Other class", isPublished: true, submissionDeadlineAt: new Date("2026-09-15") },
  ]);
  await Profile.collection.insertMany([
    { ...scope, userId: goodStudentId, shopName: "Good", profileType: id() },
    { ...scope, organization: otherOrganization, userId: studentId, shopName: "Wrong org", profileType: id() },
  ]);
  await SeatClaim.collection.insertMany([
    { ...scope, userId: studentId, status: "revoked", claimedAt: joinedAt },
    { ...scope, organization: otherOrganization, userId: studentId, status: "active", claimedAt: now },
    { ...scope, classroomId: otherClassroom, userId: studentId, status: "active", claimedAt: now },
  ]);
  await Decision.collection.insertMany(challengeDocs.flatMap((challenge) => [
    { ...scope, userId: goodStudentId, challengeId: challenge._id },
    { ...scope, userId: studentId, challengeId: challenge._id, generation: { method: "DEFAULTS" } },
    { ...scope, organization: otherOrganization, userId: studentId, challengeId: id(), generation: { method: "MANUAL" } },
  ]));
  const result = await getClassroomAttention({ classroomId, organizationId, now });
  assert.equal(result.totalEnrolled, 2);
  assert.equal(result.recentChallengeCount, 5);
  assert.deepEqual(result.counts, { all: 1, submissions: 1, setup: 1, access: 1 });
  assert.equal(result.students[0].studentId, String(studentId));
  assert.equal(result.students[0].missedCount, 5);
  assert.doesNotMatch(result.students[0].issues[0].detail, /Challenge 0|Draft|Future|Other/);

  // The close-submissions time is a fallback when no due date was configured.
  await Challenge.collection.insertOne({ ...scope, title: "Close fallback", isPublished: true, closeSubmissionsAt: new Date("2026-09-15") });
  const fallback = await getClassroomAttention({ classroomId, organizationId, now });
  assert.match(fallback.students.find((student) => student.studentId === String(studentId)).issues[0].detail, /Close fallback/);
});
