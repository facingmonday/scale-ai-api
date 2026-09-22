const mongoose = require("mongoose");
const Enrollment = require("../enrollment/enrollment.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const Profile = require("../profile/profile.model");
const SeatClaim = require("../licensing/seatClaim.model");

const RECENT_CHALLENGE_LIMIT = 5;
const MISSED_THRESHOLD = 2;

function buildReport({ classroomId, enrollments, challenges, decisions, profiles, claims, now }) {
  const profilesByUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));
  const manualDecisions = new Set(decisions
    // Legacy decisions predate generation metadata and were student submissions.
    .filter((decision) => !decision.generation?.method || decision.generation.method === "MANUAL")
    .map((decision) => `${decision.userId}:${decision.challengeId}`));
  const claimsByUser = new Map();
  for (const claim of claims) {
    const key = String(claim.userId);
    if (!claimsByUser.has(key)) claimsByUser.set(key, []);
    claimsByUser.get(key).push(claim);
  }

  const students = [];
  for (const enrollment of enrollments) {
    const member = enrollment.userId;
    if (!member?._id) continue;
    const studentId = String(member._id);
    const href = `/students/${studentId}?classroomId=${encodeURIComponent(classroomId)}`;
    const issues = [];
    const profile = profilesByUser.get(studentId);
    const joinedAt = enrollment.joinedAt || enrollment.createdDate;
    // Do not infer missed work when the enrollment date is unknown.
    const eligible = joinedAt ? challenges.filter((challenge) =>
      new Date(challenge.reviewAt).getTime() > new Date(joinedAt).getTime()) : [];
    const missed = eligible.filter((challenge) => !manualDecisions.has(`${studentId}:${challenge._id}`));

    if (missed.length >= MISSED_THRESHOLD) {
      issues.push({
        category: "submissions",
        title: "Repeated missed submissions",
        detail: `No student submission for ${missed.length} of ${eligible.length} recent past-due challenges: ${missed.map((challenge) => challenge.title).join(", ")}.`,
        actionLabel: "Review submissions",
        href,
      });
    }
    if (!profile || !profile.shopName?.trim() || !profile.profileType) {
      issues.push({
        category: "setup",
        title: "Profile setup incomplete",
        detail: !profile ? "This student has not created a profile." : "The profile is missing a name or profile type.",
        actionLabel: "Review profile",
        href,
      });
    }
    const studentClaims = claimsByUser.get(studentId) || [];
    // Enrollment currently grants classroom access. Inactive claims indicate a
    // seat to review, not proof that a student is blocked. Missing claims may be legacy.
    const latestInactive = studentClaims.find((claim) => ["held", "revoked", "expired"].includes(claim.status));
    if (latestInactive && !studentClaims.some((claim) => claim.status === "active")) {
      issues.push({
        category: "access",
        title: "Seat needs review",
        detail: `The latest inactive classroom seat is ${latestInactive.status}; no active seat is recorded.`,
        actionLabel: "Review classroom seats",
        href: `/classroom/${encodeURIComponent(classroomId)}?tab=classAccess`,
      });
    }
    if (issues.length) {
      students.push({
        studentId,
        name: [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || "Unnamed student",
        studentNumber: enrollment.studentId || "",
        href,
        missedCount: missed.length,
        issues,
      });
    }
  }
  students.sort((a, b) => b.issues.length - a.issues.length || b.missedCount - a.missedCount ||
    a.name.localeCompare(b.name) || a.studentId.localeCompare(b.studentId));
  return {
    checkedAt: now.toISOString(),
    totalEnrolled: enrollments.filter((enrollment) => enrollment.userId?._id).length,
    recentChallengeCount: challenges.length,
    counts: {
      all: students.length,
      ...Object.fromEntries(["submissions", "setup", "access"].map((category) => [
        category, students.filter((student) => student.issues.some((issue) => issue.category === category)).length,
      ])),
    },
    students,
  };
}

async function getClassroomAttention({ classroomId, organizationId, now = new Date() }) {
  const scope = { classroomId, organization: organizationId };
  const [enrollments, challenges] = await Promise.all([
    Enrollment.find({ ...scope, role: "member", isRemoved: false })
      .select("userId studentId joinedAt createdDate")
      .populate({
        path: "userId",
        match: { organizationMemberships: { $elemMatch: { organizationId, role: "org:member" } } },
        select: "firstName lastName",
      })
      .lean(),
    Challenge.aggregate([
      { $match: {
        classroomId: new mongoose.Types.ObjectId(classroomId),
        organization: new mongoose.Types.ObjectId(organizationId),
        isPublished: true,
        $or: [{ publishAt: null }, { publishAt: { $lte: now } }],
      } },
      { $addFields: { reviewAt: { $ifNull: ["$submissionDeadlineAt", "$closeSubmissionsAt"] } } },
      { $match: { reviewAt: { $type: "date", $lt: now } } },
      { $sort: { reviewAt: -1, _id: -1 } },
      { $limit: RECENT_CHALLENGE_LIMIT },
      { $project: { title: 1, reviewAt: 1 } },
    ]).option({ maxTimeMS: 10000 }),
  ]);
  const userIds = enrollments.flatMap((enrollment) => enrollment.userId?._id ? [enrollment.userId._id] : []);
  const studentScope = { ...scope, userId: { $in: userIds } };
  const [profiles, claims, decisions] = userIds.length ? await Promise.all([
    Profile.find(studentScope).select("userId shopName profileType").lean(),
    SeatClaim.find(studentScope).select("userId status claimedAt")
      .sort({ claimedAt: -1, _id: -1 }).lean(),
    challenges.length ? Decision.find({
      ...studentScope, challengeId: { $in: challenges.map((challenge) => challenge._id) },
    }).select("userId challengeId generation.method").lean() : [],
  ]) : [[], [], []];
  return buildReport({ classroomId, enrollments, challenges, decisions, profiles, claims, now });
}

module.exports = { getClassroomAttention, buildReport };
