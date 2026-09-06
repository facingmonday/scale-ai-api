const { createHash, randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");
const Run = require("../challengeEmail.model");
const Notification = require("../../notifications/notifications.model");
const Challenge = require("../challenge.model");
const Classroom = require("../../classroom/classroom.model");
const Enrollment = require("../../enrollment/enrollment.model");
const Decision = require("../../decision/decision.model");

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}
function audience(value) {
  if (!["all", "missing"].includes(value))
    fail("Choose a valid email audience");
  return value;
}
function parseTime(localTime, timezone, now = new Date()) {
  if (
    typeof localTime !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localTime)
  ) {
    fail("Enter a date and time in the classroom timezone");
  }
  const date = DateTime.fromISO(localTime, { zone: timezone });
  if (!date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm") !== localTime) {
    fail("This local time does not exist in the classroom timezone");
  }
  if (date.getPossibleOffsets().length > 1) {
    fail(
      "This time occurs twice during the daylight-saving change. Choose an unambiguous time.",
    );
  }
  if (date.toMillis() <= +now) fail("Reminder time must be in the future");
  return date.toJSDate();
}
function availability(challenge, selectedAudience, now = new Date()) {
  if (
    !challenge ||
    !Challenge.isVisibleToStudents(challenge, now) ||
    challenge.isClosed
  )
    return "Challenge is not available";
  if (selectedAudience === "missing" && challenge.isLockedForStudents)
    return "Submissions are closed";
  return null;
}
async function recipients(challenge, selectedAudience, memberId) {
  // Match the missing-submissions view: current enrollment and org:member role.
  const enrollments = await Enrollment.find({
    classroomId: challenge.classroomId,
    organization: challenge.organization,
    isRemoved: false,
    role: "member",
    ...(memberId ? { userId: memberId } : {}),
  })
    .populate({
      path: "userId",
      model: require("../../members/member.model"),
      select: "organizationMemberships",
    })
    .lean();
  const ids = [
    ...new Set(
      enrollments
        .filter((e) =>
          e.userId?.organizationMemberships?.some(
            (m) =>
              String(m.organizationId) === String(challenge.organization) &&
              m.role === "org:member",
          ),
        )
        .map((e) => String(e.userId._id)),
    ),
  ];
  if (selectedAudience === "all") return ids;
  const decisions = await Decision.find({
    organization: challenge.organization,
    classroomId: challenge.classroomId,
    challengeId: challenge._id,
    userId: { $in: ids },
  })
    .select("userId")
    .lean();
  const submitted = new Set(decisions.map((d) => String(d.userId)));
  return ids.filter((id) => !submitted.has(id));
}
function content(challenge, classroom, selectedAudience) {
  const timezone = classroom.automationSettings?.timezone || "America/Chicago";
  const host = process.env.SCALE_ADMIN_HOST || "https://localhost:5173";
  const deadline = challenge.submissionDeadlineAt
    ? DateTime.fromJSDate(new Date(challenge.submissionDeadlineAt), {
        zone: timezone,
      }).toFormat("MMM d, yyyy 'at' h:mm a ZZZZ")
    : null;
  return {
    subject: `${selectedAudience === "missing" ? "Reminder: submit your decisions" : "Challenge available"}: ${challenge.title}`,
    templateSlug:
      selectedAudience === "missing"
        ? "challenge-reminder"
        : "challenge-announcement",
    templateData: {
      challenge: { title: challenge.title },
      classroom: { name: classroom.name },
      deadline,
      timezone,
      link: `${host}/class/${challenge.classroomId}/challenge/${challenge._id}`,
    },
  };
}
async function preview(challenge, classroom, selectedAudience) {
  audience(selectedAudience);
  const unavailable = availability(challenge, selectedAudience);
  const data = content(challenge, classroom, selectedAudience);
  return {
    ...data,
    recipientCount: (await recipients(challenge, selectedAudience)).length,
    unavailable,
    deliveryDisabled: process.env.SEND_EMAIL !== "true",
    suppressed: challenge.suppressNotifications === true,
  };
}
async function skip(notification, reason) {
  await Notification.updateOne(
    { _id: notification._id, organization: notification.organization },
    {
      $set: {
        status: "Skipped",
        "metadata.emailQueued": false,
        "metadata.emailSkipped": true,
        "metadata.emailSkipReason": reason,
        "metadata.emailError": null,
      },
    },
  );
  return { skipped: true, reason };
}
async function deliveryCheck(notification) {
  const run = await Run.findOne({
    _id: notification.challengeEmailRunId,
    organization: notification.organization,
  }).lean();
  if (!run) return "Email run no longer exists";
  const challenge = await Challenge.findOne({
    _id: run.challengeId,
    organization: run.organization,
  }).lean();
  const unavailable = availability(challenge, run.audience);
  if (unavailable) return unavailable;
  if (challenge.suppressNotifications)
    return "Challenge notifications are suppressed";
  if (process.env.SEND_EMAIL !== "true") return "Email delivery is disabled";
  if (
    !(
      await recipients(challenge, run.audience, notification.recipient.id)
    ).includes(String(notification.recipient.id))
  )
    return "Student is no longer eligible";
  const classroom = await Classroom.findOne({
    _id: challenge.classroomId,
    organization: run.organization,
  }).lean();
  if (!classroom) return "Classroom no longer exists";
  const current = content(challenge, classroom, run.audience);
  notification.title = current.subject;
  notification.templateData = current.templateData;
  return null;
}
function notificationId(runId, memberId) {
  return createHash("sha256")
    .update(`challenge-email:${runId}:${memberId}`)
    .digest("hex")
    .slice(0, 24);
}
async function dispatch(runId, now = new Date()) {
  const token = randomUUID();
  const run = await Run.findOneAndUpdate(
    {
      _id: runId,
      sendAt: { $lte: now },
      attempts: { $lt: 5 },
      $or: [
        { status: { $in: ["scheduled", "pending", "failed"] } },
        { status: "dispatching", leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "dispatching",
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 300000),
        error: null,
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  );
  if (!run) return;
  const owned = {
    _id: run._id,
    organization: run.organization,
    leaseToken: token,
  };
  try {
    const challenge = await Challenge.findOne({
      _id: run.challengeId,
      organization: run.organization,
    }).lean();
    const unavailable = availability(challenge, run.audience, now);
    if (unavailable) {
      await Run.updateOne(owned, {
        $set: {
          status: "skipped",
          error: unavailable,
          completedAt: new Date(),
        },
      });
      return;
    }
    const classroom = await Classroom.findOne({
      _id: challenge.classroomId,
      organization: run.organization,
    }).lean();
    if (!classroom) fail("Classroom no longer exists", 404);
    if (!run.recipients) {
      run.recipients = await recipients(challenge, run.audience);
      await Run.updateOne(owned, { $set: { recipients: run.recipients } });
    }
    const data = content(challenge, classroom, run.audience);
    for (const memberId of run.recipients) {
      const lease = await Run.updateOne(owned, {
        $set: { leaseUntil: new Date(Date.now() + 300000) },
      });
      if (!lease.matchedCount) return;
      const id = notificationId(run._id, memberId);
      // Upsert bypasses post-save delivery. A crash between persistence and enqueue
      // is recoverable, and retries always refer to the same recipient notification.
      await Notification.updateOne(
        { _id: id, organization: run.organization },
        {
          $setOnInsert: {
            challengeEmailRunId: run._id,
            type: "email",
            recipient: { id: memberId, type: "Member", ref: "Member" },
            title: data.subject,
            message: data.subject,
            templateSlug: data.templateSlug,
            templateData: data.templateData,
            organization: run.organization,
            createdBy: run.createdBy,
            updatedBy: run.updatedBy,
            status: "Pending",
          },
        },
        { upsert: true },
      );
      const notification = await Notification.findById(id);
      if (
        notification.metadata?.emailSent ||
        notification.metadata?.emailSkipped ||
        notification.metadata?.emailQueued
      )
        continue;
      if (
        challenge.suppressNotifications ||
        process.env.SEND_EMAIL !== "true"
      ) {
        await skip(
          notification,
          challenge.suppressNotifications
            ? "Challenge notifications are suppressed"
            : "Email delivery is disabled",
        );
        continue;
      }
      const receiver = await Notification.getReceiver(
        notification.recipient,
        notification.templateData,
        notification.modelData,
        run.organization,
        { resolveEmail: false },
      );
      if (
        !receiver ||
        !Notification.checkRecipientPreferences(receiver, "email")
      ) {
        await skip(
          notification,
          receiver
            ? "Email preference is disabled"
            : "Recipient is unavailable",
        );
        continue;
      }
      await Notification.sendEmailNotification(notification, receiver, {
        throwOnError: true,
      });
    }
    await Run.updateOne(owned, {
      $set: { status: "dispatched", completedAt: new Date() },
    });
  } catch (error) {
    console.error(
      `Challenge email dispatch failed for ${run._id}:`,
      error.message,
    );
    await Run.updateOne(owned, {
      $set: { status: "failed", error: error.message },
    });
  }
}
async function dispatchDue(now = new Date()) {
  const due = await Run.find({
    sendAt: { $lte: now },
    attempts: { $lt: 5 },
    $or: [
      { status: { $in: ["scheduled", "pending", "failed"] } },
      { status: "dispatching", leaseUntil: { $lte: now } },
    ],
  })
    .select("_id")
    .sort({ sendAt: 1 })
    .limit(100)
    .lean();
  for (const run of due) await dispatch(run._id, now);
  return { checked: due.length };
}
async function history(challenge) {
  const scope = {
    challengeId: challenge._id,
    organization: challenge.organization,
  };
  const [scheduled, recent] = await Promise.all([
    Run.find({ ...scope, status: "scheduled" })
      .sort({ sendAt: 1 })
      .lean(),
    Run.find({ ...scope, status: { $ne: "scheduled" } })
      .sort({ sendAt: -1 })
      .limit(100)
      .lean(),
  ]);
  const runs = [...scheduled, ...recent];
  const counts = await Notification.aggregate([
    {
      $match: {
        organization: challenge.organization,
        challengeEmailRunId: { $in: runs.map((r) => r._id) },
      },
    },
    {
      $group: {
        _id: {
          run: "$challengeEmailRunId",
          status: "$status",
          sent: "$metadata.emailSent",
          skipped: "$metadata.emailSkipped",
          queued: "$metadata.emailQueued",
        },
        count: { $sum: 1 },
      },
    },
  ]);
  return runs.map(({ recipients: ids, leaseToken, ...run }) => {
    const totals = { queued: 0, sent: 0, skipped: 0, failed: 0, pending: 0 };
    for (const item of counts.filter(
      (c) => String(c._id.run) === String(run._id),
    )) {
      const key = item._id.sent
        ? "sent"
        : item._id.skipped
          ? "skipped"
          : item._id.status === "Failed"
            ? "failed"
            : item._id.queued
              ? "queued"
              : "pending";
      totals[key] += item.count;
    }
    totals.pending += Math.max(
      0,
      (ids?.length || 0) -
        Object.values(totals).reduce((sum, count) => sum + count, 0),
    );
    return { ...run, recipientCount: ids?.length ?? null, counts: totals };
  });
}
module.exports = {
  audience,
  parseTime,
  availability,
  recipients,
  content,
  preview,
  skip,
  deliveryCheck,
  notificationId,
  dispatch,
  dispatchDue,
  history,
  fail,
};
