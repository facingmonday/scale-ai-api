const test = require("node:test");
const assert = require("node:assert/strict");
const { setupTestDb, teardownTestDb, clearCollections, mongoose } = require("../../test/helpers/db");
const service = require("./lib/decisionReceiptService");
const Notification = require("../notifications/notifications.model");
const Challenge = require("../challenge/challenge.model");
const Member = require("../members/member.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const worker = require("../../lib/queues/email-worker");
const { queues } = require("../../lib/queues");
const { sgMail } = require("../../lib/sendGrid");
const id = () => new mongoose.Types.ObjectId();
let jobs, sent, offline;
test.before(setupTestDb);
test.after(async () => { await service.stopRecovery(); await teardownTestDb(); });
test.beforeEach(async (t) => {
  await clearCollections(); jobs = new Map(); sent = []; offline = false;
  const previous = process.env.SEND_EMAIL; process.env.SEND_EMAIL = "true";
  t.after(() => { if (previous === undefined) delete process.env.SEND_EMAIL; else process.env.SEND_EMAIL = previous; });
  t.mock.method(queues.emailSending, "getJob", async (key) => { if (offline) throw Error("Redis unavailable"); return jobs.get(key); });
  t.mock.method(worker, "enqueueEmailSending", async (data) => { jobs.set(`email-notification:${data.notificationId}`, { data }); });
  t.mock.method(Notification, "getReceiver", async () => ({ email: "student@example.com", preferences: { email: true } }));
  t.mock.method(sgMail, "send", async (data) => { sent.push(data); });
});
async function seed() {
  const organization = id(), classroomId = id(), challengeId = id(), userId = id();
  const snapshot = { emailEnabled: true, actor: "student", savedAt: "2026-09-09T19:34:05.000Z", kind: "submit",
    classroom: { _id: classroomId, organization, name: "Business", automationSettings: { timezone: "America/Chicago" } },
    challenge: { _id: challengeId, title: "Pricing" },
    decision: { _id: id(), userId, variables: { price: 0, promote: false }, challengeVariableAnswers: { reason: "Original answer" } } };
  await Challenge.collection.insertOne({ ...snapshot.challenge, classroomId, organization });
  await Member.collection.insertOne({ _id: userId, preferences: { email: true }, organizationMemberships: [{ organizationId: organization }] });
  await VariableDefinition.collection.insertOne({ classroomId, organization, challengeId, appliesTo: "decision", key: "price", label: "Saved price" });
  return snapshot;
}
async function send(notification) {
  return worker.processEmailSending({ data: { type: "email", decisionReceipt: true,
    notificationId: String(notification._id), organizationId: String(notification.organization) } });
}
test("records independent receipts for updates and renders the persisted version", async () => {
  const snapshot = await seed();
  const first = await service.record(snapshot);
  snapshot.decision.variables.price = 99; snapshot.kind = "update";
  const second = await service.record(snapshot);
  assert.notEqual(String(first._id), String(second._id));
  assert.equal(jobs.size, 2);
  await send(first); await send(second);
  assert.match(sent[0].text, /Saved price[\s\S]*0/);
  assert.match(sent[1].text, /Saved price[\s\S]*99/);
  assert.match(sent[1].subject, /^Updated submission receipt:/);
  const record = await Notification.findById(first._id);
  assert.equal(record.status, "Sent");
  assert.equal(record.templateData.savedTime, "Sep 9, 2026 at 2:34:05 PM CDT");
  await send(record); assert.equal(sent.length, 2);
});
test("queue outage leaves a durable Pending receipt; recovery enqueues only once", async () => {
  const snapshot = await seed(); offline = true;
  const receipt = await service.record(snapshot);
  assert.equal((await Notification.findById(receipt._id)).status, "Pending");
  assert.equal(jobs.size, 0);
  offline = false;
  await Promise.all([service.recoverPending(), service.recoverPending()]);
  await service.recoverPending();
  assert.equal(jobs.size, 1);
});
for (const control of ["disabled", "suppressed", "preference", "missing member", "wrong organization", "missing address"]) {
  test(`delivery rechecks ${control} and skips without sending`, async (t) => {
    const snapshot = await seed(); const receipt = await service.record(snapshot);
    if (control === "disabled") process.env.SEND_EMAIL = "false";
    if (control === "suppressed") await Challenge.collection.updateOne({ _id: snapshot.challenge._id }, { $set: { suppressNotifications: true } });
    if (control === "preference") await Member.collection.updateOne({ _id: snapshot.decision.userId }, { $set: { "preferences.email": false } });
    if (control === "missing member") await Member.collection.deleteOne({ _id: snapshot.decision.userId });
    if (control === "wrong organization") await Member.collection.updateOne({ _id: snapshot.decision.userId }, { $set: { organizationMemberships: [] } });
    if (control === "missing address") t.mock.method(Notification, "getReceiver", async () => ({ email: "", preferences: { email: true } }));
    assert.equal((await send(receipt)).skipped, true);
    assert.equal(sent.length, 0);
    assert.equal((await Notification.findById(receipt._id)).status, "Skipped");
  });
}
test("disabled at save remains skipped after emails are enabled", async () => {
  const snapshot = await seed(); snapshot.emailEnabled = false;
  const receipt = await service.record(snapshot);
  await service.recoverPending(); await send(receipt);
  assert.equal(jobs.size, 0); assert.equal(sent.length, 0);
});
test("provider failure remains manually retryable, without automatic recovery restarting it", async (t) => {
  const snapshot = await seed(); const receipt = await service.record(snapshot);
  t.mock.method(sgMail, "send", async () => { throw Error("provider unavailable"); });
  await assert.rejects(send(receipt), /Receipt delivery failed/);
  assert.equal((await Notification.findById(receipt._id)).status, "Failed");
  let inspected = false;
  t.mock.method(queues.emailSending, "getJob", async () => { inspected = true; });
  await service.recoverPending();
  assert.equal(inspected, false);
});
test("recovery processes at most 100 pending receipts", async () => {
  const snapshot = await seed(); snapshot.emailEnabled = false;
  const skipped = await service.record(snapshot);
  const base = skipped.toObject(); delete base._id;
  await Notification.insertMany(Array.from({ length: 101 }, () => ({ ...base, status: "Pending", metadata: { emailSent: false, emailSkipped: false } })));
  await service.recoverPending();
  assert.equal(jobs.size, 100);
});

test("mismatched queue organization cannot send or alter another organization's receipt", async () => {
  const snapshot = await seed(); const receipt = await service.record(snapshot);
  await assert.rejects(worker.processEmailSending({ data: { type: "email", decisionReceipt: true,
    notificationId: String(receipt._id), organizationId: String(id()) } }), /Receipt delivery failed/);
  assert.equal(sent.length, 0);
  assert.equal((await Notification.findById(receipt._id)).status, "Pending");
});

test("recovery leaves existing exhausted jobs alone even if notification is Pending", async (t) => {
  const snapshot = await seed(); const receipt = await service.record(snapshot);
  let retried = false;
  t.mock.method(queues.emailSending, "getJob", async () => ({ getState: async () => "failed", retry: async () => { retried = true; } }));
  await service.enqueue(receipt);
  assert.equal(retried, false);
});

test("recovery timer does not overlap and is cleared on shutdown", async (t) => {
  let run, cleared = false, queries = 0, resolve;
  const pending = new Promise((done) => { resolve = done; });
  const timer = { unref() {} };
  t.mock.method(global, "setInterval", (fn, delay) => { assert.equal(delay, 60000); run = fn; return timer; });
  t.mock.method(global, "clearInterval", (value) => { assert.equal(value, timer); cleared = true; });
  t.mock.method(Notification, "find", () => { queries++; return { sort: () => ({ limit: () => pending }) }; });
  service.startRecovery(); run(); run();
  assert.equal(queries, 1);
  const stopping = service.stopRecovery();
  assert.equal(cleared, true);
  resolve([]); await stopping;
});

test("recipient lookup errors fail retryably instead of marking receipt skipped", async (t) => {
  const snapshot = await seed(); const receipt = await service.record(snapshot);
  t.mock.method(Notification, "getReceiver", async (_recipient, _data, _models, _org, options) => {
    assert.equal(options.throwOnError, true);
    throw new Error("temporary address lookup failure");
  });
  await assert.rejects(send(receipt), /Receipt delivery failed/);
  const result = await Notification.findById(receipt._id);
  assert.equal(result.status, "Failed");
  assert.equal(result.metadata.emailSkipped, false);
});
