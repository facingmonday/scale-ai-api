const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Classroom = require("../classroom/classroom.model");
const Notification = require("../notifications/notifications.model");
const SimulationJob = require("../job/job.model");
const service = require("./studentActivity.service");
const controller = require("./studentActivity.controller");

const id = () => new mongoose.Types.ObjectId().toString();
const organizationId = id();
const classroomId = id();
const studentId = id();
const options = { organizationId, classroomId, studentId, offset: 0, limit: 10 };

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(overrides = {}) {
  return {
    query: { classroomId }, params: { studentId },
    organization: { _id: organizationId }, user: { _id: studentId },
    clerkUser: { id: "clerk-actor" }, ...overrides,
  };
}

test("students can only request their own recorded activity", async (t) => {
  const access = t.mock.method(Classroom, "validateStudentAccess", async () => {});
  const activity = t.mock.method(service, "getActivity", async () => ({ data: [], hasMore: false }));
  const res = response();
  await controller.getStudentActivity(request({ query: { classroomId, studentId: id(), limit: "5", offset: "10" } }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(access.mock.calls[0].arguments, [classroomId, "clerk-actor", organizationId]);
  assert.deepEqual(activity.mock.calls[0].arguments[0], { ...options, offset: 10, limit: 5 });
});

test("teachers must pass classroom authorization before loading the selected student", async (t) => {
  let authorized = false;
  t.mock.method(Classroom, "validateAdminAccess", async (...args) => {
    assert.deepEqual(args, [classroomId, "clerk-actor", organizationId]);
    authorized = true;
  });
  t.mock.method(service, "getActivity", async (args) => {
    assert.equal(authorized, true);
    assert.deepEqual(args, options);
    return { data: [], hasMore: false };
  });
  const res = response();
  await controller.getTeacherActivity(request({ user: { _id: id() } }), res);
  assert.equal(res.statusCode, 200);
});

for (const role of ["Student", "Teacher"]) {
  test(`${role.toLowerCase()} denied classroom access cannot read activity`, async (t) => {
    t.mock.method(Classroom, role === "Student" ? "validateStudentAccess" : "validateAdminAccess", async () => {
      throw new Error("Insufficient permissions: not enrolled");
    });
    const activity = t.mock.method(service, "getActivity", async () => { throw new Error("Must not read"); });
    const res = response();
    await controller[`get${role}Activity`](request(), res);
    assert.equal(res.statusCode, 403);
    assert.equal(activity.mock.callCount(), 0);
  });
}

for (const query of [
  {}, { classroomId: "bad-id" }, { classroomId, offset: "-1" },
  { classroomId, offset: "1.5" }, { classroomId, offset: "10001" },
  { classroomId, limit: "0" }, { classroomId, limit: "51" },
  { classroomId, limit: "NaN" }, { classroomId: { $ne: null } },
]) {
  test(`invalid activity parameters are rejected: ${JSON.stringify(query)}`, async (t) => {
    const activity = t.mock.method(service, "getActivity", async () => { throw new Error("Must not read"); });
    const res = response();
    await controller.getStudentActivity(request({ query }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(activity.mock.callCount(), 0);
  });
}

test("activity failures return a generic error without provider details", async (t) => {
  t.mock.method(Classroom, "validateStudentAccess", async () => {});
  t.mock.method(service, "getActivity", async () => { throw new Error("Private prompt contents"); });
  t.mock.method(console, "error", () => {});
  const res = response();
  await controller.getStudentActivity(request(), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "Activity is temporarily unavailable." });
});

test("both activity sources are scoped to the organization, classroom and student", () => {
  const pipeline = service.buildPipeline(options);
  const receiptMatch = pipeline[0].$match;
  assert.equal(String(receiptMatch.organization), organizationId);
  assert.equal(String(receiptMatch["recipient.id"]), studentId);
  assert.equal(String(receiptMatch["decisionReceipt.classroomId"]), classroomId);
  assert.equal(receiptMatch.templateSlug, "decision-receipt");
  assert.equal(receiptMatch.status, undefined, "Skipped email still records a saved submission");

  const union = pipeline.find((stage) => stage.$unionWith).$unionWith;
  assert.equal(union.coll, SimulationJob.collection.name);
  const jobMatch = union.pipeline[0].$match;
  assert.equal(String(jobMatch.organization), organizationId);
  assert.equal(String(jobMatch.classroomId), classroomId);
  assert.equal(String(jobMatch.userId), studentId);
  assert.deepEqual(jobMatch.dryRun, { $ne: true });
  assert.deepEqual(jobMatch.purpose, { $ne: "replacement" });
  assert.deepEqual(union.pipeline.at(-1).$project, {
    _id: 0,
    id: { $concat: ["job:", { $toString: "$_id" }, ":", { $toString: "$eventIndex" }] },
    at: "$history.at", action: "$history.action", challengeId: 1,
  }, "Job errors, prompts and result details are not exposed");
});

test("combined pagination has a deterministic tie-breaker and bounded read", () => {
  const pipeline = service.buildPipeline({ ...options, offset: 20 });
  assert.deepEqual(pipeline.find((stage) => stage.$sort), { $sort: { at: -1, id: -1 } });
  assert.deepEqual(pipeline.find((stage) => stage.$skip !== undefined), { $skip: 20 });
  assert.deepEqual(pipeline.find((stage) => stage.$limit), { $limit: 11 });
});

test("activity returns saved snapshots, excludes unrelated fields and reports another page", async (t) => {
  const events = [
    {
      id: "receipt:1", at: new Date(), action: "update", challengeId: id(),
      challengeTitle: "Title at submission", hiddenNotes: "secret",
      answers: { variables: { price: 0 }, challengeVariableAnswers: { accept: false }, labels: { "decision:price": "Saved price" } },
    },
    { id: "job:1:0", at: new Date(), action: "processing_completed", challengeId: id(), rawPrompt: "secret" },
    { id: "receipt:older", at: new Date(), action: "submit" },
  ];
  t.mock.method(Notification, "aggregate", () => ({ option: async (config) => {
    assert.deepEqual(config, { maxTimeMS: 10000 });
    return events;
  } }));
  const result = await service.getActivity({ ...options, limit: 2 });
  assert.equal(result.hasMore, true);
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].title, "Submission updated");
  assert.deepEqual(result.data[0].answers, events[0].answers);
  assert.equal(result.data[0].hiddenNotes, undefined);
  assert.equal(result.data[1].rawPrompt, undefined);
  assert.equal(result.data[1].answers, undefined);
  assert.equal(result.data[1].challengeTitle, "Challenge no longer available");
});

test("no stored activity returns an empty page without inferring a missed submission", async (t) => {
  t.mock.method(Notification, "aggregate", () => ({ option: async () => [] }));
  assert.deepEqual(await service.getActivity(options), { data: [], hasMore: false, offset: 0, limit: 10 });
});
