const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const templateService = require("../../lib/template-service");
const { sgMail } = require("../../lib/sendGrid");
const { sendEmail } = require("../../lib/sendGrid/sendEmail");
const Notification = require("./notifications.model");

test("template model data maps ledger to the registered LedgerEntry model", () => {
  assert.equal(templateService.getModelName("ledger"), "LedgerEntry");
});

test("disabled email delivery returns a skipped result", async (t) => {
  const originalSendEmail = process.env.SEND_EMAIL;
  t.after(() => {
    if (originalSendEmail === undefined) delete process.env.SEND_EMAIL;
    else process.env.SEND_EMAIL = originalSendEmail;
  });

  process.env.SEND_EMAIL = "false";

  const result = await sendEmail({
    to: { email: "student@example.com", name: "Student" },
    from: { email: "no-reply@example.com", name: "SCALE" },
    subject: "Results available",
    html: "<p>Results available</p>",
  });

  assert.deepEqual(result, {
    sent: false,
    skipped: true,
    reason: "SEND_EMAIL is not set to 'true'",
  });
});

test("successful email delivery returns a sent result", async (t) => {
  const originalSendEmail = process.env.SEND_EMAIL;
  t.after(() => {
    if (originalSendEmail === undefined) delete process.env.SEND_EMAIL;
    else process.env.SEND_EMAIL = originalSendEmail;
  });

  process.env.SEND_EMAIL = "true";
  const sendMock = t.mock.method(sgMail, "send", async () => [{}]);

  const result = await sendEmail({
    to: { email: "student@example.com", name: "Student" },
    from: { email: "no-reply@example.com", name: "SCALE" },
    subject: "Results available",
    html: "<p>Results available</p>",
  });

  assert.deepEqual(result, { sent: true, skipped: false });
  assert.equal(sendMock.mock.callCount(), 1);
});

test("notification schema records skipped email delivery", () => {
  const organizationId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  const notification = new Notification({
    type: "email",
    recipient: { type: "Member", ref: "Member" },
    title: "Results available",
    message: "Your results are available.",
    organization: organizationId,
    createdBy: actorId,
    updatedBy: actorId,
    status: "Skipped",
    metadata: {
      emailSent: false,
      emailQueued: false,
      emailSkipped: true,
      emailSkipReason: "SEND_EMAIL is not set to 'true'",
    },
  });

  const validationError = notification.validateSync();
  assert.equal(validationError, undefined);
  assert.equal(notification.metadata.emailSkipped, true);
  assert.equal(
    notification.metadata.emailSkipReason,
    "SEND_EMAIL is not set to 'true'"
  );
});
