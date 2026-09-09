const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const service = require("./lib/decisionReceiptService");
const controller = require("./decision.controller");
const Decision = require("./decision.model");
const Challenge = require("../challenge/challenge.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");
const Automation = require("../ai/automationTask.model");
const tick = () => new Promise(setImmediate);
function input() {
  return { decision: { _id: "decision", variables: { price: 0 }, challengeVariableAnswers: { reason: "first" } },
    classroom: { organization: "org" }, challenge: { _id: "challenge" }, kind: "submit" };
}
test("hook waits for response, clones answers, and runs once for finish plus close", async (t) => {
  const calls = [];
  t.mock.method(service, "record", async (snapshot) => calls.push(snapshot));
  const res = new EventEmitter();
  const snapshot = input();
  service.afterResponse(res, snapshot);
  snapshot.decision.variables.price = 99;
  await tick();
  assert.equal(calls.length, 0);
  res.emit("finish"); res.emit("close");
  assert.equal(calls.length, 0);
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].decision.variables.price, 0);
});
test("closed connections and receipt persistence failures never escape into submission", async (t) => {
  let calls = 0;
  t.mock.method(service, "record", async () => { calls++; throw new Error("database unavailable"); });
  t.mock.method(console, "error", () => {});
  for (const alreadyClosed of [false, true]) {
    const res = new EventEmitter(); res.destroyed = alreadyClosed;
    service.afterResponse(res, input());
    if (!alreadyClosed) res.emit("close");
  }
  await tick(); await tick();
  assert.equal(calls, 2);
});
for (const kind of ["submit", "update"]) {
  for (const fails of [false, true]) {
    test(`${kind}: ${fails ? "failed save creates no receipt" : "response does not await receipt work"}`, async (t) => {
      const snapshot = input();
      snapshot.decision.userId = "student";
      t.mock.method(Challenge, "findById", async () => ({ _id: "challenge", classroomId: "class", title: "Pricing" }));
      t.mock.method(Classroom, "findById", async () => ({ _id: "class", organization: "org" }));
      t.mock.method(Enrollment, "isUserEnrolled", async () => true);
      t.mock.method(Decision, kind === "submit" ? "createSubmission" : "updateSubmission", async () => {
        if (fails) throw new Error("Invalid decision variables: required");
        return snapshot.decision;
      });
      t.mock.method(Automation, "trigger", async () => {});
      t.mock.method(console, "error", () => {});
      let calls = 0;
      t.mock.method(service, "record", () => { calls++; return new Promise(() => {}); });
      const res = new EventEmitter();
      res.statusCode = 200;
      res.status = (status) => { res.statusCode = status; return res; };
      res.json = (body) => { res.body = body; res.emit("finish"); return res; };
      await controller[kind === "submit" ? "submitWeeklyDecisions" : "updateWeeklyDecisions"]({
        body: { challengeId: "challenge", variables: { price: 999 } }, user: { _id: "student" }, clerkUser: { id: "clerk" },
      }, res);
      assert.equal(calls, 0);
      assert.equal(res.statusCode, fails ? 400 : kind === "submit" ? 201 : 200);
      await tick();
      assert.equal(calls, fails ? 0 : 1);
    });
  }
}
test("receipt HTML and plain text preserve values and escape markup", async () => {
  const { renderTemplate } = require("../../lib/emails/renderer");
  const fixture = require("../../apps/admin/fixtures/decision-receipt.json");
  const { html, text } = await renderTemplate("decision-receipt", fixture);
  for (const content of [html, text]) {
    for (const value of ["Pricing strategy", "false", "(No answer)", "First line", "Second line", fixture.receiptNumber]) assert.ok(content.includes(value));
  }
  assert.ok(html.includes("&lt;special&gt;"));
  assert.ok(!html.includes("<special>"));
  assert.match(text, /Price[\s\S]*0/);
  assert.ok(html.includes("white-space:pre-wrap"));
  assert.ok(text.includes("First line\nSecond line"));
});

test("receipt address lookup propagates transient Clerk errors for retry", async (t) => {
  const Member = require("../members/member.model");
  const { clerkClient } = require("@clerk/express");
  t.mock.method(Object.getPrototypeOf(clerkClient.users), "getUser", async () => { throw new Error("temporary Clerk outage"); });
  const member = new Member({ clerkUserId: "user_test" });
  await assert.rejects(member.getEmailFromClerk({ throwOnError: true }), /temporary Clerk outage/);
});
