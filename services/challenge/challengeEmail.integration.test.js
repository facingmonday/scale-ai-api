const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");
const Run = require("./challengeEmail.model");
const Challenge = require("./challenge.model");
const Classroom = require("../classroom/classroom.model");
const Member = require("../members/member.model");
const Enrollment = require("../enrollment/enrollment.model");
const Decision = require("../decision/decision.model");
const Notification = require("../notifications/notifications.model");
const service = require("./lib/challengeEmailService");
const controller = require("./challengeEmail.controller");
const worker = require("../../lib/queues/email-worker");
const id = () => new mongoose.Types.ObjectId();
let queued;

test.before(async () => {
  await setupTestDb();
  await Run.init();
});
test.after(teardownTestDb);
test.beforeEach(async (t) => {
  await clearCollections();
  queued = [];
  const old = process.env.SEND_EMAIL;
  process.env.SEND_EMAIL = "true";
  t.after(() => {
    if (old === undefined) delete process.env.SEND_EMAIL;
    else process.env.SEND_EMAIL = old;
  });
  t.mock.method(Notification, "getReceiver", async () => ({
    email: "student@example.com",
    preferences: { email: true },
  }));
  t.mock.method(worker, "enqueueEmailSending", async (data) => {
    queued.push(data.notificationId);
    return { id: data.notificationId };
  });
});
async function seed() {
  const organization = id(),
    classroomId = id(),
    challengeId = id();
  const base = { organization, createdBy: "teacher", updatedBy: "teacher" };
  const classroom = {
    _id: classroomId,
    name: "Strategy",
    ...base,
    automationSettings: { timezone: "America/Chicago" },
  };
  await Classroom.collection.insertOne(classroom);
  const challenge = {
    _id: challengeId,
    classroomId,
    ...base,
    title: "Pricing",
    isPublished: true,
    isClosed: false,
    isLockedForStudents: false,
  };
  await Challenge.collection.insertOne(challenge);
  const students = [id(), id()];
  for (const userId of students) {
    await Member.collection.insertOne({
      _id: userId,
      clerkUserId: String(userId),
      ...base,
      organizationMemberships: [
        { organizationId: organization, role: "org:member" },
      ],
    });
    await Enrollment.collection.insertOne({
      userId,
      classroomId,
      ...base,
      role: "member",
      isRemoved: false,
    });
  }
  return { organization, classroom, challenge, students, base };
}
async function makeRun(f, extra = {}) {
  return Run.create({
    ...f.base,
    challengeId: f.challenge._id,
    audience: "missing",
    kind: "scheduled",
    requestKey: String(id()),
    sendAt: new Date(Date.now() - 1000),
    timezone: "America/Chicago",
    status: "scheduled",
    ...extra,
  });
}
function response() {
  return {
    code: 200,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}
function request(f, body = {}, params = {}) {
  return {
    organization: { _id: f.organization },
    clerkUser: { id: "teacher" },
    params: { challengeId: String(f.challenge._id), ...params },
    body,
  };
}

test("audiences exclude removed students and administrators, and reminders exclude existing decisions", async () => {
  const f = await seed();
  await Decision.collection.insertOne({
    ...f.base,
    classroomId: f.classroom._id,
    challengeId: f.challenge._id,
    userId: f.students[0],
  });
  assert.equal(
    (await service.preview(f.challenge, f.classroom, "all")).recipientCount,
    2,
  );
  assert.deepEqual(await service.recipients(f.challenge, "missing"), [
    String(f.students[1]),
  ]);
  await Enrollment.updateOne(
    { userId: f.students[1] },
    { $set: { isRemoved: true } },
  );
  assert.equal((await service.recipients(f.challenge, "all")).length, 1);
  await Member.collection.updateOne(
    { _id: f.students[0] },
    { $set: { "organizationMemberships.0.role": "org:admin" } },
  );
  assert.equal((await service.recipients(f.challenge, "all")).length, 0);
});
test("overlapping dispatches create one notification per recipient; retry resumes partial queue failure", async (t) => {
  const f = await seed(),
    run = await makeRun(f);
  let calls = 0;
  t.mock.method(worker, "enqueueEmailSending", async (data) => {
    if (++calls === 2) throw new Error("queue offline");
    queued.push(data.notificationId);
    return {};
  });
  await Promise.all([service.dispatch(run._id), service.dispatch(run._id)]);
  assert.equal((await Run.findById(run._id)).status, "failed");
  await service.dispatch(run._id);
  assert.equal((await Run.findById(run._id)).status, "dispatched");
  assert.equal(await Notification.countDocuments(), 2);
  assert.equal(new Set(queued).size, 2);
  assert.equal(queued.length, 2);
  await service.dispatchDue();
  assert.equal(queued.length, 2);
});
test("worker skips students who submitted or left after queueing, and honors completed notification retries", async () => {
  const f = await seed(),
    run = await makeRun(f);
  await service.dispatch(run._id);
  await Decision.collection.insertOne({
    ...f.base,
    classroomId: f.classroom._id,
    challengeId: f.challenge._id,
    userId: f.students[0],
  });
  await Enrollment.updateOne(
    { userId: f.students[1] },
    { $set: { isRemoved: true } },
  );
  for (const notificationId of queued) {
    const result = await worker.processEmailSending({
      data: { type: "email", notificationId },
    });
    assert.equal(result.skipped, true);
  }
  const history = await service.history(f.challenge);
  assert.equal(history[0].counts.skipped, 2);
  assert.equal(history[0].counts.queued, 0);
  assert.equal(
    (
      await worker.processEmailSending({
        data: { type: "email", notificationId: queued[0] },
      })
    ).alreadyProcessed,
    true,
  );
});
test("disabled delivery and preferences are tracked as skipped, including empty audiences", async (t) => {
  const f = await seed();
  process.env.SEND_EMAIL = "false";
  const run = await makeRun(f);
  await service.dispatch(run._id);
  assert.equal(queued.length, 0);
  assert.equal((await service.history(f.challenge))[0].counts.skipped, 2);
  process.env.SEND_EMAIL = "true";
  t.mock.method(Notification, "getReceiver", async () => ({
    preferences: { email: false },
  }));
  const preferences = await makeRun(f);
  await service.dispatch(preferences._id);
  assert.equal(
    await Notification.countDocuments({
      challengeEmailRunId: preferences._id,
      status: "Skipped",
    }),
    2,
  );
  await Enrollment.updateMany({}, { $set: { isRemoved: true } });
  const empty = await makeRun(f);
  await service.dispatch(empty._id);
  assert.equal((await Run.findById(empty._id)).status, "dispatched");
  assert.equal((await Run.findById(empty._id)).recipients.length, 0);
});
test("overdue closed, locked, unpublished and deleted challenges are skipped permanently", async () => {
  const f = await seed();
  for (const change of [
    { isClosed: true },
    { isClosed: false, isLockedForStudents: true },
    { isLockedForStudents: false, isPublished: false },
  ]) {
    await Challenge.collection.updateOne(
      { _id: f.challenge._id },
      { $set: change },
    );
    const run = await makeRun(f);
    await service.dispatch(run._id);
    assert.equal((await Run.findById(run._id)).status, "skipped");
  }
  await Challenge.collection.deleteOne({ _id: f.challenge._id });
  const run = await makeRun(f);
  await service.dispatch(run._id);
  assert.equal((await Run.findById(run._id)).status, "skipped");
  await Challenge.collection.insertOne(f.challenge);
  await service.dispatchDue();
  assert.equal(queued.length, 0);
});
test("manual requests are idempotent and enforce organization and classroom access", async (t) => {
  const f = await seed();
  t.mock.method(Classroom, "validateAdminAccess", async () => true);
  const req = request(f, {
    audience: "all",
    requestKey: "manual-request-123456",
  });
  const a = response(),
    b = response();
  await controller.send(req, a);
  await controller.send(req, b);
  assert.equal(a.code, 202);
  assert.equal(String(a.body.data.runId), String(b.body.data.runId));
  assert.equal(await Run.countDocuments(), 1);
  assert.equal(queued.length, 2);
  const foreign = response();
  await controller.list({ ...req, organization: { _id: id() } }, foreign);
  assert.equal(foreign.code, 404);
  t.mock.method(Classroom, "validateAdminAccess", async () => {
    throw new Error("Insufficient permissions");
  });
  const denied = response();
  await controller.send(req, denied);
  assert.equal(denied.code, 403);
  const unauth = response();
  await controller.list({ ...req, clerkUser: null }, unauth);
  assert.equal(unauth.code, 401);
});
test("multiple reminders can be scheduled, edited and cancelled only before dispatch", async (t) => {
  const f = await seed();
  t.mock.method(Classroom, "validateAdminAccess", async () => true);
  const responses = [];
  for (const day of ["01", "02"]) {
    const res = response();
    await controller.schedule(
      request(f, {
        localTime: `2090-07-${day}T09:00`,
        requestKey: `schedule-request-${day}`,
      }),
      res,
    );
    assert.equal(res.code, 201);
    responses.push(res.body.data);
  }
  assert.equal(responses[0].sendAt.toISOString(), "2090-07-01T14:00:00.000Z");
  const reminderId = String(responses[0]._id);
  const edit = response();
  await controller.schedule(
    request(f, { localTime: "2090-07-03T10:00" }, { reminderId }),
    edit,
  );
  assert.equal(edit.code, 200);
  const cancel = response();
  await controller.cancel(request(f, {}, { reminderId }), cancel);
  assert.equal(cancel.body.data.status, "cancelled");
  const lateEdit = response();
  await controller.schedule(
    request(f, { localTime: "2090-07-04T10:00" }, { reminderId }),
    lateEdit,
  );
  assert.equal(lateEdit.code, 409);
  assert.equal(await Run.countDocuments({ status: "scheduled" }), 1);
});

test("successful delivery uses refreshed deadline and records sent; retry does not resend", async (t) => {
  const { sgMail } = require("../../lib/sendGrid");
  const messages = [];
  t.mock.method(sgMail, "send", async (data) => {
    messages.push(data);
    return [{}];
  });
  const f = await seed(),
    run = await makeRun(f);
  await service.dispatch(run._id);
  await Challenge.collection.updateOne(
    { _id: f.challenge._id },
    {
      $set: {
        title: "Updated title",
        submissionDeadlineAt: new Date("2026-09-08T22:00:00Z"),
      },
    },
  );
  const job = { data: { type: "email", notificationId: queued[0] } };
  await worker.processEmailSending(job);
  assert.equal(messages.length, 1);
  assert.ok(messages[0].html.includes("Updated title"));
  assert.ok(messages[0].html.includes("5:00 PM"));
  assert.equal((await service.history(f.challenge))[0].counts.sent, 1);
  await worker.processEmailSending(job);
  assert.equal(messages.length, 1);
});
test("delivery failure is counted and a queue retry can complete it", async (t) => {
  const { sgMail } = require("../../lib/sendGrid");
  let attempts = 0;
  t.mock.method(sgMail, "send", async () => {
    if (++attempts === 1) throw new Error("provider unavailable");
    return [{}];
  });
  const f = await seed(),
    run = await makeRun(f);
  await service.dispatch(run._id);
  const job = { data: { type: "email", notificationId: queued[0] } };
  await assert.rejects(worker.processEmailSending(job), /provider unavailable/);
  assert.equal((await service.history(f.challenge))[0].counts.failed, 1);
  await worker.processEmailSending(job);
  assert.equal((await service.history(f.challenge))[0].counts.sent, 1);
  assert.equal((await service.history(f.challenge))[0].counts.failed, 0);
});
test("expired dispatch leases recover and lifecycle scheduler works with manual challenge automation", async (t) => {
  const f = await seed();
  await Challenge.collection.updateOne(
    { _id: f.challenge._id },
    { $set: { automationMode: "MANUAL" } },
  );
  const expired = await makeRun(f, {
    status: "dispatching",
    leaseToken: "old-worker",
    leaseUntil: new Date(0),
  });
  const future = await makeRun(f, { sendAt: new Date("2090-01-01") });
  for (const method of [
    "publishDueScenarios",
    "closeDueSubmissions",
    "processDueOutcomes",
    "releaseDelayedFeedback",
  ]) {
    t.mock.method(Challenge, method, async () => []);
  }
  const result = await Challenge.runScenarioLifecycleCheck();
  assert.equal(result.reminders.checked, 1);
  assert.equal((await Run.findById(expired._id)).status, "dispatched");
  assert.equal((await Run.findById(future._id)).status, "scheduled");
});
test("queued emails respect newly suppressed challenges, disabled delivery, preferences and closure", async (t) => {
  const f = await seed();
  for (const change of [
    "suppress",
    "disabled",
    "preferences",
    "locked",
    "deleted",
  ]) {
    process.env.SEND_EMAIL = "true";
    await Challenge.collection.updateOne(
      { _id: f.challenge._id },
      { $set: { suppressNotifications: false, isLockedForStudents: false } },
    );
    t.mock.method(Notification, "getReceiver", async () => ({
      email: "student@example.com",
      preferences: { email: true },
    }));
    const run = await makeRun(f);
    await service.dispatch(run._id);
    if (change === "suppress")
      await Challenge.collection.updateOne(
        { _id: f.challenge._id },
        { $set: { suppressNotifications: true } },
      );
    if (change === "disabled") process.env.SEND_EMAIL = "false";
    if (change === "preferences")
      t.mock.method(Notification, "getReceiver", async () => ({
        preferences: { email: false },
      }));
    if (change === "locked")
      await Challenge.collection.updateOne(
        { _id: f.challenge._id },
        { $set: { isLockedForStudents: true } },
      );
    if (change === "deleted")
      await Challenge.collection.deleteOne({ _id: f.challenge._id });
    const notificationId = service.notificationId(run._id, f.students[0]);
    assert.equal(
      (
        await worker.processEmailSending({
          data: { type: "email", notificationId },
        })
      ).skipped,
      true,
    );
  }
});
