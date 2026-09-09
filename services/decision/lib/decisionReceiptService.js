const { DateTime } = require("luxon");
const Notification = require("../../notifications/notifications.model");
const Challenge = require("../../challenge/challenge.model");
const Member = require("../../members/member.model");

function logFailure(stage, ids) {
  // Provider errors can include request bodies. Log identifiers only.
  console.error("Decision receipt failure", { stage, ...ids });
}

function afterResponse(res, input) {
  try {
    if (!input.decision?._id) return;
    const snapshot = JSON.parse(JSON.stringify(input));
    snapshot.savedAt = new Date().toISOString();
    snapshot.emailEnabled = process.env.SEND_EMAIL === "true";
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      res.removeListener("finish", schedule);
      res.removeListener("close", schedule);
      setImmediate(() => {
        module.exports.record(snapshot).catch(() => logFailure("record", {
          decisionId: snapshot.decision._id,
          organizationId: snapshot.classroom.organization,
        }));
      });
    };
    res.once("finish", schedule);
    res.once("close", schedule);
    if (res.writableFinished || res.destroyed) schedule();
  } catch {
    logFailure("schedule", { decisionId: String(input.decision?._id || "") });
  }
}

async function deliveryCheck(notification) {
  if (process.env.SEND_EMAIL !== "true") return "Email delivery is disabled";
  const receipt = notification.decisionReceipt;
  const challenge = await Challenge.findOne({
    _id: receipt.challengeId,
    classroomId: receipt.classroomId,
    organization: notification.organization,
  }).select("suppressNotifications").lean();
  if (!challenge) return "Challenge is unavailable";
  if (challenge.suppressNotifications) return "Challenge notifications are suppressed";
  const member = await Member.findOne({
    _id: notification.recipient.id,
    "organizationMemberships.organizationId": notification.organization,
  }).select("preferences").lean();
  if (!member) return "Recipient is unavailable";
  if (!Notification.checkRecipientPreferences(member, "email")) return "Email preference is disabled";
  return null;
}

async function skip(notification, reason) {
  await Notification.updateOne({ _id: notification._id, organization: notification.organization }, {
    $set: { status: "Skipped", "metadata.emailSkipped": true,
      "metadata.emailSkipReason": reason, "metadata.emailQueued": false },
  });
  return { success: true, skipped: true, reason, notificationId: String(notification._id) };
}

async function enqueue(notification) {
  const reason = await deliveryCheck(notification);
  if (reason) return skip(notification, reason);
  const { queues } = require("../../../lib/queues");
  const existing = await queues.emailSending.getJob(`email-notification:${notification._id}`);
  // In particular, never automatically restart an exhausted delivery job.
  if (existing) return;
  const { enqueueEmailSending } = require("../../../lib/queues/email-worker");
  await enqueueEmailSending({ notificationId: String(notification._id),
    organizationId: String(notification.organization), type: "email", decisionReceipt: true });
  await Notification.updateOne({ _id: notification._id, organization: notification.organization,
    status: "Pending" }, { $set: { "metadata.emailQueued": true } });
}

async function record(snapshot) {
  const { decision, classroom, challenge, kind, actor, savedAt } = snapshot;
  const notification = new Notification({
    type: "email", recipient: { id: decision.userId, type: "Member", ref: "Member" },
    organization: classroom.organization, createdBy: actor, updatedBy: actor,
    title: `${kind === "update" ? "Updated submission receipt" : "Submission receipt"}: ${challenge.title}`,
    message: "Your decisions were saved successfully.", templateSlug: "decision-receipt",
    decisionReceipt: { decisionId: decision._id, challengeId: challenge._id,
      classroomId: classroom._id, savedAt, kind },
    templateData: {
      challenge: { title: challenge.title }, classroom: { name: classroom.name },
      variables: decision.variables || {}, challengeVariableAnswers: decision.challengeVariableAnswers || {},
      labels: {}, kind, savedAt,
      timezone: classroom.automationSettings?.timezone || "America/Chicago",
      link: `${(process.env.SCALE_ADMIN_HOST || "https://localhost:5173").replace(/\/$/, "")}/class/${classroom._id}/challenge/${challenge._id}`,
    },
  });
  notification.templateData.receiptNumber = String(notification._id);
  notification.templateData.savedTime = DateTime.fromISO(savedAt, {
    zone: notification.templateData.timezone,
  }).toFormat("MMM d, yyyy 'at' h:mm:ss a ZZZZ");
  // Labels are optional presentation metadata; never reload the saved answers.
  try {
    const definitions = await require("../../variableDefinition/variableDefinition.model").find({
      organization: classroom.organization, classroomId: classroom._id,
      appliesTo: { $in: ["decision", "challenge"] },
      $or: [{ challengeId: null }, { challengeId: challenge._id }],
    }).select("key label appliesTo challengeId").sort({ challengeId: 1 }).lean();
    for (const def of definitions) {
      notification.templateData.labels[`${def.appliesTo}:${def.key}`] = def.label || def.key;
    }
  } catch { /* Raw keys remain usable when labels are unavailable. */ }
  const initialSkip = !snapshot.emailEnabled ? "Email delivery is disabled"
    : challenge.suppressNotifications ? "Challenge notifications are suppressed" : null;
  if (initialSkip) {
    notification.status = "Skipped";
    notification.metadata.emailSkipped = true;
    notification.metadata.emailSkipReason = initialSkip;
  }
  await notification.save();
  if (initialSkip) return notification;
  try {
    const reason = await deliveryCheck(notification);
    if (reason) return await skip(notification, reason);
    await enqueue(notification);
  } catch {
    logFailure("enqueue", { notificationId: String(notification._id), decisionId: String(decision._id) });
    // Leave Pending for the worker's recovery sweep.
  }
  return notification;
}

// A process-local guard prevents overlapping sweeps; deterministic queue IDs
// also make concurrent worker instances safe to enqueue the same pending record.
let recoveryPromise;
let recoveryTimer;
async function recoverPending() {
  if (recoveryPromise) return recoveryPromise;
  recoveryPromise = (async () => {
    const pending = await Notification.find({ templateSlug: "decision-receipt", status: "Pending",
      "decisionReceipt.decisionId": { $exists: true },
      "metadata.emailSent": { $ne: true }, "metadata.emailSkipped": { $ne: true },
    }).sort({ _id: 1 }).limit(100);
    for (const notification of pending) {
      try { await enqueue(notification); }
      catch { logFailure("recovery-enqueue", { notificationId: String(notification._id) }); }
    }
  })();
  try { await recoveryPromise; } finally { recoveryPromise = null; }
}
function startRecovery() {
  if (recoveryTimer) return;
  const run = () => recoverPending().catch(() => logFailure("recovery", {}));
  recoveryTimer = setInterval(run, 60_000);
  recoveryTimer.unref();
  void run();
}
async function stopRecovery() {
  clearInterval(recoveryTimer);
  recoveryTimer = null;
  await recoveryPromise?.catch(() => {});
}
module.exports = { afterResponse, record, deliveryCheck, skip, enqueue, recoverPending, startRecovery, stopRecovery };
