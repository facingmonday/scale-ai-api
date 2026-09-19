const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");
const Classroom = require("../classroom/classroom.model");
const Challenge = require("../challenge/challenge.model");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");
const Decision = require("../decision/decision.model");
const { GradeAdjustment, GradeExclusion } = require("./grading.model");
const service = require("./grading.service");
const { prepareExport } = require("./grading.csv");
const { creationGrading } = require("../../lib/gradingSettings");
const { getUsersRoutes } = require("../../lib/routes");

const id = () => new mongoose.Types.ObjectId();
test.before(async () => {
  await setupTestDb();
  await Promise.all([GradeAdjustment.init(), GradeExclusion.init()]);
});
test.after(teardownTestDb);
test.beforeEach(clearCollections);

async function fixture(count = 2, challengeCount = 2) {
  const organizationId = id(),
    classroomId = id(),
    teacher = id();
  const scope = { organization: organizationId, classroomId };
  const actor = `teacher-${teacher}`;
  await Member.collection.insertOne({
    _id: teacher,
    clerkUserId: actor,
    organizationMemberships: [{ organizationId, role: "org:admin" }],
  });
  await Classroom.collection.insertOne({
    _id: classroomId,
    organization: organizationId,
    ownership: teacher,
    name: "Grading fixture",
    gradingSettings: { defaultChallengePoints: 7.5 },
  });
  const students = Array.from({ length: count }, (_, i) => ({
    _id: id(),
    clerkUserId: `student-${i}`,
    firstName: `Student ${String(i).padStart(4, "0")}`,
    lastName: "Example",
    organizationMemberships: [{ organizationId, role: "org:member" }],
  }));
  await Member.collection.insertMany(students);
  await Enrollment.collection.insertMany(
    students.map((s, i) => ({
      ...scope,
      userId: s._id,
      role: "member",
      isRemoved: false,
      joinedAt: new Date("2020-01-01"),
      studentId: String(i).padStart(6, "0"),
    })),
  );
  const challenges = Array.from({ length: challengeCount }, (_, i) => ({
    ...scope,
    _id: id(),
    title: `Challenge ${i + 1}`,
    week: i + 1,
    isPublished: true,
    submissionDeadlineAt: new Date("2021-01-01"),
    grading: creationGrading(5),
    createdBy: actor,
    updatedBy: actor,
  }));
  await Challenge.collection.insertMany(challenges);
  return {
    organizationId,
    classroomId: String(classroomId),
    actor,
    students,
    challenges,
    classroom: { gradingSettings: { defaultChallengePoints: 7.5 } },
    filters: service.parseFilters(),
  };
}

function target(f, challenge = 0, student = 0) {
  return {
    ...f,
    challengeId: String(f.challenges[challenge]._id),
    userId: String(f.students[student]._id),
  };
}

test("batched gradebook reads are tenant-scoped and include students with no profile or decision", async () => {
  const f = await fixture();
  await Decision.collection.insertMany([
    {
      classroomId: new mongoose.Types.ObjectId(f.classroomId),
      organization: f.organizationId,
      challengeId: f.challenges[0]._id,
      userId: f.students[0]._id,
      generation: { method: "MANUAL" },
    },
    {
      classroomId: new mongoose.Types.ObjectId(f.classroomId),
      organization: id(),
      challengeId: f.challenges[1]._id,
      userId: f.students[0]._id,
      generation: { method: "MANUAL" },
    },
  ]);
  const data = await service.getGradebook(f);
  assert.equal(data.rows.length, 2);
  assert.deepEqual(data.rows[0].totals, {
    earnedPoints: 5,
    possiblePoints: 10,
    percentage: 50,
  });
  assert.equal(data.rows[1].cells[0].status, "MISSING");
  assert.equal(
    (await service.getGradebook({ ...f, organizationId: id() })).rows.length,
    0,
  );
  await assert.rejects(
    service.getGradebook({
      ...f,
      filters: service.parseFilters({ challengeIds: [String(id())] }),
    }),
    /not in this classroom/,
  );
  await Member.deleteOne({ _id: f.students[1]._id });
  const missingIdentity = await service.getGradebook(f);
  assert.equal(missingIdentity.rows.length, 2);
  assert.equal(
    missingIdentity.rows.find((row) => row.userId === String(f.students[1]._id))
      .name,
    "Unnamed student",
  );
});

test("adjustments use atomic revisions, retain history, and do not modify decisions", async () => {
  const f = await fixture();
  const options = target(f);
  const input = {
    mode: "POINTS",
    points: 2.25,
    reason: "Partial credit",
    expectedRevision: 0,
  };
  const writes = await Promise.allSettled([
    service.saveChange(options, input),
    service.saveChange(options, { ...input, points: 3 }),
  ]);
  assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    writes.find((r) => r.status === "rejected").reason.statusCode,
    409,
  );
  await service.saveChange(options, {
    mode: "EXCUSED",
    reason: "Approved absence",
    expectedRevision: 1,
  });
  const history = await service.history(options);
  assert.deepEqual(
    history.changes.map((c) => c.revision),
    [2, 1],
  );
  assert.equal(
    (await service.getGradebook(f)).rows[0].cells[0].status,
    "EXCUSED",
  );
  await service.saveChange(options, {
    mode: "AUTOMATIC",
    reason: "Restore rule",
    expectedRevision: 2,
  });
  assert.equal(
    (await service.getGradebook(f)).rows[0].cells[0].effectivePoints,
    0,
  );
  assert.equal(await Decision.countDocuments({}), 0);
  await assert.rejects(
    service.saveChange(options, { ...input, points: 6, expectedRevision: 3 }),
    /maximum/,
  );
  await assert.rejects(
    service.saveChange({ ...options, organizationId: id() }, input),
    (e) => e.statusCode === 404,
  );
  await assert.rejects(
    service.saveChange({ ...options, userId: String(id()) }, input),
    (e) => e.statusCode === 404,
  );
});

test("challenge exclusion is reversible and preserves individual adjustments", async () => {
  const f = await fixture();
  await service.saveChange(target(f), {
    mode: "POINTS",
    points: 4,
    reason: "Credit",
    expectedRevision: 0,
  });
  const options = { ...f, challengeId: String(f.challenges[0]._id) };
  await service.saveChange(
    options,
    { excluded: true, reason: "Cancelled assignment", expectedRevision: 0 },
    "exclusion",
  );
  let data = await service.getGradebook(f);
  assert.equal(data.rows[0].cells[0].status, "EXCLUDED");
  assert.equal(data.rows[0].totals.possiblePoints, 5);
  await service.saveChange(
    options,
    { excluded: false, reason: "Restore assignment", expectedRevision: 1 },
    "exclusion",
  );
  data = await service.getGradebook(f);
  assert.equal(data.rows[0].cells[0].effectivePoints, 4);
  assert.equal((await service.history(options, "exclusion")).changes.length, 2);
});

test("historical challenges remain ungraded and graded metadata is immutable and hidden in ordinary reads", async () => {
  const f = await fixture();
  const scope = {
    classroomId: new mongoose.Types.ObjectId(f.classroomId),
    organization: f.organizationId,
  };
  const old = await Challenge.collection.insertOne({
    ...scope,
    title: "Old",
    week: 3,
    isPublished: true,
    createdBy: f.actor,
    updatedBy: f.actor,
  });
  let doc = await Challenge.findById(old.insertedId);
  doc.description = "Changed description";
  await doc.save();
  assert.equal(
    (await Challenge.collection.findOne({ _id: old.insertedId })).grading,
    undefined,
  );
  doc = await Challenge.findById(f.challenges[0]._id);
  assert.equal(doc.toObject().grading, undefined);
  assert.equal(
    (await Classroom.findById(f.classroomId)).toObject().gradingSettings,
    undefined,
  );
  const authorized = await Classroom.validateAdminAccess(
    f.classroomId,
    f.actor,
    f.organizationId,
  );
  assert.equal(authorized.gradingSettings.defaultChallengePoints, 7.5);
  doc = await Challenge.findById(f.challenges[0]._id).select("+grading");
  doc.grading.pointsPossible = 99;
  await doc.save();
  assert.equal(
    (await Challenge.collection.findOne({ _id: f.challenges[0]._id })).grading
      .pointsPossible,
    5,
  );
  await assert.rejects(
    service.saveChange(
      {
        ...f,
        challengeId: String(old.insertedId),
        userId: String(f.students[0]._id),
      },
      { mode: "POINTS", points: 5, reason: "Old work", expectedRevision: 0 },
    ),
    /ungraded/,
  );
});

test("new creation snapshots the authorized classroom default and permits existing clients", async () => {
  const f = await fixture();
  for (const [input, expected] of [
    [{}, 7.5],
    [{ pointsPossible: 0 }, 0],
    [{ pointsPossible: 12.25 }, 12.25],
  ]) {
    const created = await Challenge.createScenario(
      f.classroomId,
      { title: "New", ...input },
      f.organizationId,
      f.actor,
      { classroom: f.classroom },
    );
    const stored = await Challenge.collection.findOne({ _id: created._id });
    assert.equal(stored.grading.pointsPossible, expected);
    assert.equal(stored.grading.policyVersion, 1);
    assert.ok(stored.grading.includedAt instanceof Date);
  }
  const legacyClient = await Challenge.createScenario(
    f.classroomId,
    { title: "No options" },
    f.organizationId,
    f.actor,
  );
  assert.equal(
    (await Challenge.collection.findOne({ _id: legacyClient._id })).grading
      .pointsPossible,
    5,
  );
});

test("CSV exports all filtered students, independent of page, from the same scoring service", async () => {
  const f = await fixture(3);
  await service.saveChange(target(f, 0, 2), {
    mode: "POINTS",
    points: 5,
    reason: "Credit",
    expectedRevision: 0,
  });
  const options = {
    ...f,
    filters: service.parseFilters({
      limit: 1,
      page: 2,
      sort: "earned",
      direction: "desc",
    }),
  };
  const data = await service.getGradebook(options);
  assert.equal(data.rows.length, 1);
  const wide = await prepareExport(options, "gradebook");
  let csv = "";
  for await (const chunk of wide.chunks) csv += chunk;
  assert.equal(csv.trim().split("\r\n").length, 4);
  assert.match(csv.split("\r\n")[1], new RegExp(String(f.students[2]._id)));
  assert.match(csv, /"5","10","50"/);
  const detailed = await prepareExport(options, "detailed");
  let lines = "";
  for await (const chunk of detailed.chunks) lines += chunk;
  assert.equal(lines.trim().split("\r\n").length, 7);
});

test("removed/re-enrolled students and deleted parents cannot create duplicate or orphan gradebook rows", async () => {
  const f = await fixture();
  const scope = {
    classroomId: new mongoose.Types.ObjectId(f.classroomId),
    organization: f.organizationId,
    userId: f.students[0]._id,
  };
  await Enrollment.updateOne(scope, {
    $set: { isRemoved: true, removedAt: new Date("2022-01-01") },
  });
  assert.equal((await service.getGradebook(f)).rows.length, 1);
  assert.equal(
    (
      await service.getGradebook({
        ...f,
        filters: service.parseFilters({ includeRemoved: true }),
      })
    ).rows.length,
    2,
  );
  await Enrollment.collection.insertOne({
    ...scope,
    role: "member",
    isRemoved: false,
    joinedAt: new Date("2023-01-01"),
  });
  assert.equal((await service.getGradebook(f)).rows.length, 2);
  await service.saveChange(target(f), {
    mode: "POINTS",
    points: 3,
    reason: "Credit",
    expectedRevision: 0,
  });
  await Challenge.collection.deleteOne({ _id: f.challenges[0]._id });
  assert.equal((await service.getGradebook(f)).columns.length, 1);
  await require("./grading.cleanup").cleanup({
    organization: f.organizationId,
    classroomId: f.classroomId,
    challengeId: f.challenges[0]._id,
  });
  assert.equal(
    await GradeAdjustment.countDocuments({ organization: f.organizationId }),
    0,
  );
});

test("grading cleanup failures cannot fail permanent deletion and repair is idempotent", async (t) => {
  const f = await fixture();
  for (let challenge = 0; challenge < 2; challenge++)
    await service.saveChange(target(f, challenge), {
      mode: "POINTS",
      points: 3,
      reason: "Reviewed",
      expectedRevision: 0,
    });
  const errors = [];
  t.mock.method(console, "error", (...args) => errors.push(args));
  const deletion = t.mock.method(GradeAdjustment, "deleteMany", () => ({
    maxTimeMS: async () => {
      throw new Error("Injected grading cleanup failure");
    },
  }));
  const deleted = await Challenge.deleteScenario(f.challenges[0]._id);
  assert.equal(String(deleted._id), String(f.challenges[0]._id));
  await new Promise(setImmediate);
  assert.equal((await service.getGradebook(f)).columns.length, 1);
  const stats = await Classroom.deleteClassroom(
    f.classroomId,
    f.organizationId,
  );
  assert.equal(stats.classroomDeleted, true);
  await new Promise(setImmediate);
  assert.equal(errors.length, 2);
  assert.equal(
    await GradeAdjustment.countDocuments({ organization: f.organizationId }),
    2,
  );
  deletion.mock.restore();
  const scope = { organization: f.organizationId, classroomId: f.classroomId };
  const { cleanup } = require("./grading.cleanup");
  await cleanup(scope);
  await cleanup(scope);
  assert.equal(await GradeAdjustment.countDocuments(scope), 0);
});

test("HTTP routes reject students, scope teachers, support the kill switch, and isolate grading failures", async (t) => {
  const f = await fixture();
  const auth = require("../../middleware/auth");
  t.mock.method(auth, "requireAuth", () => (req, res, next) => {
    if (!req.headers["x-test-user"]) return res.sendStatus(401);
    req.clerkUser = { id: req.headers["x-test-user"] };
    req.organization = { _id: f.organizationId };
    next();
  });
  t.mock.method(
    auth,
    "checkRole",
    () => (req, res, next) =>
      req.headers["x-test-role"] === "teacher" ? next() : res.sendStatus(403),
  );
  delete require.cache[require.resolve("./index")];
  const app = express();
  app.use(express.json());
  app.use("/:classroomId/gradebook", require("./index"));
  const url = `/${f.classroomId}/gradebook`;
  await request(app).get(url).expect(401);
  await request(app).get(url).set("x-test-user", f.actor).expect(403);
  const get = (path = url) =>
    request(app)
      .get(path)
      .set("x-test-user", f.actor)
      .set("x-test-role", "teacher");
  await get().expect(200);
  await get(`/${id()}/gradebook`).expect(404);
  await request(app)
    .put(`${url}/settings`)
    .set("x-test-user", f.actor)
    .set("x-test-role", "teacher")
    .send({ defaultChallengePoints: 9 })
    .expect(200);
  assert.equal(
    (await get(`${url}/settings`)).body.data.defaultChallengePoints,
    9,
  );
  const previous = process.env.GRADEBOOK_ENABLED;
  t.after(() => {
    if (previous === undefined) delete process.env.GRADEBOOK_ENABLED;
    else process.env.GRADEBOOK_ENABLED = previous;
  });
  process.env.GRADEBOOK_ENABLED = "false";
  await get().expect(404);
  assert.ok(
    !getUsersRoutes({ activeClassroom: {}, orgRole: "org:admin" }).some(
      (r) => r?.key === "gradebook",
    ),
  );
  process.env.GRADEBOOK_ENABLED = "true";
  assert.ok(
    getUsersRoutes({ activeClassroom: {}, orgRole: "org:admin" }).some(
      (r) => r?.key === "gradebook",
    ),
  );
  assert.ok(
    !getUsersRoutes({ activeClassroom: {}, orgRole: "org:member" }).some(
      (r) => r?.key === "gradebook",
    ),
  );
  t.mock.method(service, "getGradebook", async () => {
    throw new Error("Simulated grading outage");
  });
  await get().expect(500);
  // Authoring uses only the pure metadata helper; no grading service calls.
  const created = await Challenge.createScenario(
    f.classroomId,
    { title: "Created during outage" },
    f.organizationId,
    f.actor,
  );
  assert.ok(created._id);
  // Real submission writes continue while every grading read is failing.
  const submitted = await Decision.createSubmission(
    f.classroomId,
    f.challenges[0]._id,
    f.students[0]._id,
    {},
    f.organizationId,
    "student",
  );
  assert.equal(submitted.generation.method, "MANUAL");
  const updated = await Decision.updateSubmission(
    f.classroomId,
    f.challenges[0]._id,
    f.students[0]._id,
    {},
    f.organizationId,
    "student",
  );
  assert.equal(updated.generation.method, "MANUAL");
});

test("1,000 students × 100 challenges use bounded batches for totals and exports", async (t) => {
  const f = await fixture(1000, 100);
  for (let offset = 0; offset < f.students.length; offset += 100) {
    await Decision.collection.insertMany(
      f.students.slice(offset, offset + 100).flatMap((student) =>
        f.challenges.map((challenge, index) => ({
          classroomId: new mongoose.Types.ObjectId(f.classroomId),
          organization: f.organizationId,
          userId: student._id,
          challengeId: challenge._id,
          generation: { method: index % 2 ? "DEFAULTS" : "MANUAL" },
        })),
      ),
    );
  }
  let reads = 0;
  const original = Decision.collection.find.bind(Decision.collection);
  t.mock.method(Decision.collection, "find", (...args) => {
    reads++;
    return original(...args);
  });
  const start = performance.now();
  const data = await service.getGradebook({
    ...f,
    filters: service.parseFilters({ sort: "percentage" }),
  });
  assert.equal(data.rows.length, 50);
  assert.equal(data.totalStudents, 1000);
  assert.equal(reads, 11); // Ten ranking batches, then one page.
  assert.equal(data.rows[0].totals.possiblePoints, 500);
  assert.equal(data.rows[0].totals.earnedPoints, 250);
  const result = await prepareExport(f, "gradebook");
  let chunks = 0,
    bytes = 0;
  for await (const chunk of result.chunks) {
    chunks++;
    bytes += Buffer.byteLength(chunk);
  }
  assert.equal(chunks, 1001);
  assert.equal(reads, 21);
  assert.ok(bytes > 100000);
  t.diagnostic(
    `100k cells: page/ranking + full CSV took ${Math.round(performance.now() - start)}ms; ${reads} decision queries, ${bytes} CSV bytes.`,
  );
});
