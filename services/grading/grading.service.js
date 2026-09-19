const mongoose = require("mongoose");
const Enrollment = require("../enrollment/enrollment.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const { GradeAdjustment, GradeExclusion } = require("./grading.model");
const {
  calculateCell,
  calculateTotals,
  timestamp,
} = require("./grading.rules");
const { validatePoints, defaultPoints } = require("../../lib/gradingSettings");

const QUERY_MS = 5000;
const BATCH_SIZE = 100;
const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
const id = (value) =>
  typeof value === "string" && mongoose.isObjectIdOrHexString(value);

function parseFilters(input = {}) {
  const page = input.page === undefined ? 1 : Number(input.page);
  const limit = input.limit === undefined ? 50 : Number(input.limit);
  const search = input.search ?? "";
  const sort = input.sort ?? "name";
  const direction = input.direction ?? "asc";
  let challengeIds = input.challengeIds ?? [];
  if (typeof challengeIds === "string")
    challengeIds = challengeIds ? challengeIds.split(",") : [];
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    typeof search !== "string" ||
    search.length > 200 ||
    !["name", "earned", "percentage"].includes(sort) ||
    !["asc", "desc"].includes(direction) ||
    !Array.isArray(challengeIds) ||
    challengeIds.length > 1000 ||
    !challengeIds.every(id) ||
    ![undefined, true, false, "true", "false"].includes(input.includeRemoved)
  )
    throw fail("Invalid gradebook filters.");
  return {
    page,
    limit,
    search: search.trim().toLowerCase(),
    sort,
    direction,
    challengeIds: [...new Set(challengeIds)],
    includeRemoved:
      input.includeRemoved === true || input.includeRemoved === "true",
  };
}

function buildRoster(enrollments, { includeRemoved, search }) {
  const byUser = new Map();
  for (const enrollment of enrollments) {
    const member = enrollment.userId;
    if (!member?._id) continue;
    const userId = String(member._id);
    const student = byUser.get(userId);
    const joinedAt = enrollment.joinedAt || enrollment.createdDate || null;
    if (!student) {
      byUser.set(userId, {
        userId,
        firstName: member.firstName || "",
        lastName: member.lastName || "",
        name:
          [member.firstName, member.lastName].filter(Boolean).join(" ") ||
          "Unnamed student",
        studentNumber: enrollment.studentId || "",
        joinedAt,
        isRemoved: !!enrollment.isRemoved,
        removedAt: enrollment.removedAt || null,
      });
    } else {
      if (
        timestamp(joinedAt) !== null &&
        (timestamp(student.joinedAt) === null ||
          timestamp(joinedAt) < timestamp(student.joinedAt))
      )
        student.joinedAt = joinedAt;
      if (!enrollment.isRemoved) {
        student.isRemoved = false;
        student.removedAt = null;
        student.studentNumber = enrollment.studentId || student.studentNumber;
      } else if (
        student.isRemoved &&
        timestamp(enrollment.removedAt) > timestamp(student.removedAt)
      )
        student.removedAt = enrollment.removedAt;
    }
  }
  return [...byUser.values()].filter(
    (s) =>
      (includeRemoved || !s.isRemoved) &&
      (!search ||
        `${s.firstName} ${s.lastName} ${s.studentNumber}`
          .toLowerCase()
          .includes(search)),
  );
}

function nameCompare(a, b) {
  return (
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName) ||
    a.userId.localeCompare(b.userId)
  );
}

async function loadContext({
  classroomId,
  organizationId,
  classroom,
  filters,
  now = new Date(),
  signal,
  deadline = Date.now() + 30000,
}) {
  const scope = { classroomId, organization: organizationId };
  // Projection-only raw reads avoid variable population and unrelated model hooks.
  const [enrollments, challenges, exclusions] = await Promise.all([
    Enrollment.find({ ...scope, role: "member" })
      .select("userId studentId joinedAt createdDate isRemoved removedAt")
      .populate({
        path: "userId",
        select: "firstName lastName",
        options: { maxTimeMS: QUERY_MS },
        // Keep the enrollment even if its member's display record is unavailable.
        transform: (member, originalId) => member || { _id: originalId },
      })
      .limit(10001)
      .maxTimeMS(QUERY_MS)
      .lean(),
    Challenge.collection
      .find(
        { ...castScope(scope), week: { $ne: 0 } },
        {
          projection: {
            title: 1,
            week: 1,
            grading: 1,
            isPublished: 1,
            isClosed: 1,
            isLockedForStudents: 1,
            publishAt: 1,
            submissionDeadlineAt: 1,
            closeSubmissionsAt: 1,
            missingSubmissionPolicy: 1,
          },
          maxTimeMS: QUERY_MS,
        },
      )
      .sort({ week: 1, _id: 1 })
      .limit(1001)
      .toArray(),
    GradeExclusion.find(scope)
      .select("challengeId excluded reason revision")
      .maxTimeMS(QUERY_MS)
      .lean(),
  ]);
  if (enrollments.length > 10000 || challenges.length > 1000)
    throw fail("This classroom exceeds the preview gradebook size limit.", 413);
  if (
    filters.challengeIds.some(
      (value) => !challenges.some((c) => String(c._id) === value),
    )
  )
    throw fail("A selected challenge is not in this classroom.");
  const selected = filters.challengeIds.length
    ? challenges.filter((c) => filters.challengeIds.includes(String(c._id)))
    : challenges;
  return {
    classroomId,
    organizationId,
    scope,
    now,
    filters,
    signal,
    deadline,
    defaultChallengePoints: defaultPoints(classroom),
    roster: buildRoster(enrollments, filters),
    challenges: selected,
    exclusions: new Map(exclusions.map((e) => [String(e.challengeId), e])),
  };
}

function castScope(scope) {
  return Object.fromEntries(
    Object.entries(scope).map(([key, value]) => [
      key,
      new mongoose.Types.ObjectId(String(value)),
    ]),
  );
}

async function loadRows(context, students) {
  if (context.signal?.aborted) throw fail("Gradebook request cancelled.", 499);
  if (Date.now() > context.deadline)
    throw fail("Gradebook request timed out. Try fewer challenges.", 503);
  if (!students.length) return [];
  const scope = {
    ...context.scope,
    userId: { $in: students.map((s) => new mongoose.Types.ObjectId(s.userId)) },
    challengeId: { $in: context.challenges.map((c) => c._id) },
  };
  const [decisions, adjustments] = context.challenges.length
    ? await Promise.all([
        Decision.collection
          .find(
            { ...scope, ...castScope(context.scope) },
            {
              projection: { userId: 1, challengeId: 1, "generation.method": 1 },
              maxTimeMS: QUERY_MS,
            },
          )
          .toArray(),
        GradeAdjustment.find(scope).maxTimeMS(QUERY_MS).lean(),
      ])
    : [[], []];
  const key = (value) => `${value.userId}:${value.challengeId}`;
  const decisionMap = new Map(decisions.map((d) => [key(d), d]));
  const adjustmentMap = new Map(adjustments.map((a) => [key(a), a]));
  return students.map((student) => {
    const cells = context.challenges.map((challenge) =>
      calculateCell({
        student,
        challenge,
        now: context.now,
        decision: decisionMap.get(`${student.userId}:${challenge._id}`),
        adjustment: adjustmentMap.get(`${student.userId}:${challenge._id}`),
        exclusion: context.exclusions.get(String(challenge._id)),
      }),
    );
    return { ...student, cells, totals: calculateTotals(cells) };
  });
}

async function orderedRoster(context) {
  const { sort, direction } = context.filters;
  const sign = direction === "desc" ? -1 : 1;
  if (sort === "name")
    return [...context.roster].sort((a, b) => sign * nameCompare(a, b));
  const ranked = [];
  for (let offset = 0; offset < context.roster.length; offset += BATCH_SIZE) {
    const rows = await loadRows(
      context,
      context.roster.slice(offset, offset + BATCH_SIZE),
    );
    ranked.push(...rows.map(({ cells, ...row }) => row));
  }
  return ranked.sort((a, b) => {
    const field = sort === "earned" ? "earnedPoints" : "percentage";
    const av = a.totals[field],
      bv = b.totals[field];
    if (av === null || bv === null)
      return av === bv ? nameCompare(a, b) : av === null ? 1 : -1;
    return sign * (av - bv) || nameCompare(a, b);
  });
}

function columns(context) {
  return context.challenges.map((c) => ({
    id: String(c._id),
    title: c.title,
    week: c.week,
    pointsPossible: c.grading?.pointsPossible ?? null,
    policyVersion: c.grading?.policyVersion ?? null,
    includedAt: c.grading?.includedAt ?? null,
    dueAt: c.submissionDeadlineAt || c.closeSubmissionsAt || null,
    excluded: context.exclusions.get(String(c._id))?.excluded || false,
    exclusionRevision: context.exclusions.get(String(c._id))?.revision || 0,
    exclusionReason: context.exclusions.get(String(c._id))?.reason || "",
  }));
}

async function getGradebook(options) {
  const context = await loadContext(options);
  const roster = await orderedRoster(context);
  const { page, limit } = options.filters;
  const rows = await loadRows(
    context,
    roster.slice((page - 1) * limit, page * limit),
  );
  return {
    evaluatedAt: context.now.toISOString(),
    classroomId: String(options.classroomId),
    defaultChallengePoints: context.defaultChallengePoints,
    columns: columns(context),
    rows,
    totalStudents: roster.length,
    page,
    limit,
  };
}

async function validateTarget({
  classroomId,
  organizationId,
  challengeId,
  userId,
}) {
  if (!id(challengeId) || (userId !== undefined && !id(userId)))
    throw fail("Invalid grading target.");
  const scope = { classroomId, organization: organizationId, challengeId };
  const [challenge, enrollment] = await Promise.all([
    Challenge.collection.findOne(
      {
        _id: new mongoose.Types.ObjectId(challengeId),
        ...castScope({ classroomId, organization: organizationId }),
      },
      {
        projection: { grading: 1, week: 1, isPublished: 1, publishAt: 1 },
        maxTimeMS: QUERY_MS,
      },
    ),
    userId
      ? Enrollment.findOne({
          classroomId,
          organization: organizationId,
          userId,
          role: "member",
        })
          .select("_id")
          .maxTimeMS(QUERY_MS)
          .lean()
      : true,
  ]);
  if (!challenge || !enrollment)
    throw fail("Grading target not found in this classroom.", 404);
  return { scope: { ...scope, ...(userId ? { userId } : {}) }, challenge };
}

async function saveChange(options, input, kind = "adjustment") {
  const { scope, challenge } = await validateTarget(options);
  if (!challenge.grading || challenge.week === 0)
    throw fail("Existing ungraded challenges cannot be graded this semester.");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (
    !reason ||
    reason.length > 2000 ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  )
    throw fail("A reason and valid expectedRevision are required.");
  let state;
  if (kind === "exclusion") {
    if (typeof input.excluded !== "boolean")
      throw fail("excluded must be a boolean.");
    state = { excluded: input.excluded };
  } else {
    if (
      !challenge.isPublished ||
      (timestamp(challenge.publishAt) !== null &&
        timestamp(challenge.publishAt) > Date.now())
    )
      throw fail("Grade adjustments are available after the challenge opens.");
    if (!["AUTOMATIC", "POINTS", "EXCUSED"].includes(input.mode))
      throw fail("Invalid adjustment mode.");
    const points =
      input.mode === "POINTS" ? validatePoints(input.points, "points") : null;
    if (points !== null && points > challenge.grading.pointsPossible)
      throw fail("Points cannot exceed the frozen challenge maximum.");
    state = { mode: input.mode, points };
  }
  const Model = kind === "exclusion" ? GradeExclusion : GradeAdjustment;
  const now = new Date();
  try {
    const document = await Model.findOneAndUpdate(
      { ...scope, revision: input.expectedRevision },
      {
        $set: { ...state, reason, updatedBy: options.actor, updatedDate: now },
        $setOnInsert: { ...scope, createdBy: options.actor, createdDate: now },
        $inc: { revision: 1 },
        $push: {
          history: {
            ...state,
            reason,
            actor: options.actor,
            at: now,
            revision: input.expectedRevision + 1,
          },
        },
      },
      {
        upsert: input.expectedRevision === 0,
        new: true,
        runValidators: true,
        maxTimeMS: QUERY_MS,
      },
    );
    if (!document)
      throw fail(
        "This grade changed. Refresh and review the latest value before saving.",
        409,
      );
    return document.toObject();
  } catch (error) {
    if (error.code === 11000)
      throw fail(
        "This grade changed. Refresh and review the latest value before saving.",
        409,
      );
    throw error;
  }
}

async function history(options, kind = "adjustment") {
  const { scope } = await validateTarget(options);
  const Model = kind === "exclusion" ? GradeExclusion : GradeAdjustment;
  const revisionBefore = options.before;
  if (
    revisionBefore !== undefined &&
    (!Number.isSafeInteger(revisionBefore) || revisionBefore < 1)
  )
    throw fail("Invalid history cursor.");
  const match = { ...castScope(scope) };
  const [result] = await Model.aggregate([
    { $match: match },
    {
      $project: {
        revision: 1,
        history: {
          $slice: [
            {
              $filter: {
                input: "$history",
                as: "change",
                cond: revisionBefore
                  ? { $lt: ["$$change.revision", revisionBefore] }
                  : true,
              },
            },
            -101,
          ],
        },
      },
    },
  ]).option({ maxTimeMS: QUERY_MS });
  const changes = (result?.history || []).reverse();
  return {
    revision: result?.revision || 0,
    changes: changes.slice(0, 100),
    nextBefore: changes.length > 100 ? changes[99].revision : null,
  };
}

module.exports = {
  getGradebook,
  parseFilters,
  loadContext,
  loadRows,
  orderedRoster,
  columns,
  saveChange,
  history,
  buildRoster,
  BATCH_SIZE,
  QUERY_MS,
  fail,
};
