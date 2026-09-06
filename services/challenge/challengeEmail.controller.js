const mongoose = require("mongoose");
const Challenge = require("./challenge.model");
const Classroom = require("../classroom/classroom.model");
const Run = require("./challengeEmail.model");
const service = require("./lib/challengeEmailService");

const handler = (fn) => async (req, res) => {
  try {
    if (!req.organization?._id || !req.clerkUser?.id)
      service.fail("Authentication required", 401);
    if (!mongoose.isValidObjectId(req.params.challengeId))
      service.fail("Invalid challenge ID");
    const challenge = await Challenge.findOne({
      _id: req.params.challengeId,
      organization: req.organization._id,
    }).lean();
    if (!challenge) service.fail("Challenge not found", 404);
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      req.clerkUser.id,
      req.organization._id,
    );
    const classroom = await Classroom.findOne({
      _id: challenge.classroomId,
      organization: req.organization._id,
    }).lean();
    if (!classroom) service.fail("Classroom not found", 404);
    await fn(req, res, challenge, classroom);
  } catch (error) {
    const status =
      error.statusCode ||
      (error.message?.includes("Insufficient permissions")
        ? 403
        : ["ValidationError", "CastError"].includes(error.name)
          ? 400
          : 500);
    res
      .status(status)
      .json({
        error:
          status === 500 ? "Unable to process challenge emails" : error.message,
      });
    if (status === 500) console.error("Challenge email error:", error);
  }
};
exports.list = handler(async (req, res, challenge, classroom) => {
  res.json({
    data: {
      timezone: classroom.automationSettings?.timezone || "America/Chicago",
      runs: await service.history(challenge),
    },
  });
});
exports.preview = handler(async (req, res, challenge, classroom) => {
  res.json({
    data: await service.preview(challenge, classroom, req.body.audience),
  });
});
exports.send = handler(async (req, res, challenge, classroom) => {
  const audience = service.audience(req.body.audience);
  const key = req.body.requestKey;
  if (typeof key !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(key))
    service.fail("A valid requestKey is required");
  const query = {
    organization: challenge.organization,
    challengeId: challenge._id,
    requestKey: `manual:${key}`,
  };
  let run = await Run.findOne(query);
  if (run && run.audience !== audience)
    service.fail(
      "This requestKey was already used for a different audience",
      409,
    );
  if (!run) {
    const unavailable = service.availability(challenge, audience);
    if (unavailable) service.fail(unavailable, 409);
    try {
      run = await Run.create({
        ...query,
        audience,
        kind: "manual",
        status: "pending",
        sendAt: new Date(),
        timezone: classroom.automationSettings?.timezone || "America/Chicago",
        createdBy: req.clerkUser.id,
        updatedBy: req.clerkUser.id,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      run = await Run.findOne(query);
      if (run.audience !== audience)
        service.fail(
          "This requestKey was already used for a different audience",
          409,
        );
    }
  }
  await service.dispatch(run._id);
  res.status(202).json({ data: { runId: run._id } });
});
exports.schedule = handler(async (req, res, challenge, classroom) => {
  if (challenge.isClosed || challenge.isLockedForStudents)
    service.fail("Submissions are closed", 409);
  const timezone = classroom.automationSettings?.timezone || "America/Chicago";
  const sendAt = service.parseTime(req.body.localTime, timezone);
  if (
    challenge.publishMode === "SCHEDULED" &&
    challenge.publishAt &&
    sendAt < new Date(challenge.publishAt)
  )
    service.fail("Reminder must be after the challenge opens");
  // Actual lock state controls eligibility in instructor-controlled challenges.
  if (
    challenge.automationMode === "FULL" &&
    challenge.closeSubmissionsAt &&
    sendAt >= new Date(challenge.closeSubmissionsAt)
  )
    service.fail("Reminder must be before submissions close");
  const common = {
    organization: challenge.organization,
    challengeId: challenge._id,
  };
  if (req.params.reminderId) {
    const run = await Run.findOneAndUpdate(
      {
        ...common,
        _id: req.params.reminderId,
        kind: "scheduled",
        status: "scheduled",
      },
      { $set: { sendAt, timezone, updatedBy: req.clerkUser.id } },
      { new: true },
    );
    if (!run)
      service.fail("Reminder has already started or is unavailable", 409);
    res.json({ data: run });
  } else {
    const key = req.body.requestKey;
    if (typeof key !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(key))
      service.fail("A valid requestKey is required");
    const query = { ...common, requestKey: `scheduled:${key}` };
    let run;
    try {
      run = await Run.findOneAndUpdate(
        query,
        {
          $setOnInsert: {
            ...query,
            audience: "missing",
            kind: "scheduled",
            status: "scheduled",
            sendAt,
            timezone,
            createdBy: req.clerkUser.id,
            updatedBy: req.clerkUser.id,
          },
        },
        { upsert: true, new: true, runValidators: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      run = await Run.findOne(query);
    }
    res.status(201).json({ data: run });
  }
});
exports.cancel = handler(async (req, res, challenge) => {
  const run = await Run.findOneAndUpdate(
    {
      _id: req.params.reminderId,
      organization: challenge.organization,
      challengeId: challenge._id,
      kind: "scheduled",
      status: "scheduled",
    },
    { $set: { status: "cancelled", updatedBy: req.clerkUser.id } },
    { new: true },
  );
  if (!run) service.fail("Reminder has already started or is unavailable", 409);
  res.json({ data: run });
});

/**
 * @openapi
 * components:
 *   parameters:
 *     ChallengeEmailChallengeId:
 *       in: path
 *       name: challengeId
 *       required: true
 *       schema: { type: string }
 *     ChallengeEmailReminderId:
 *       in: path
 *       name: reminderId
 *       required: true
 *       schema: { type: string }
 *   schemas:
 *     ChallengeEmailAudienceInput:
 *       type: object
 *       required: [audience]
 *       properties:
 *         audience: { type: string, enum: [all, missing] }
 *     ChallengeEmailSendInput:
 *       allOf:
 *         - $ref: '#/components/schemas/ChallengeEmailAudienceInput'
 *         - type: object
 *           required: [requestKey]
 *           properties:
 *             requestKey:
 *               type: string
 *               description: Client UUID reused when retrying the same logical send.
 *     ChallengeReminderInput:
 *       type: object
 *       required: [localTime]
 *       properties:
 *         localTime:
 *           type: string
 *           description: YYYY-MM-DDTHH:mm in the classroom timezone; must be a future, unambiguous local time.
 *         requestKey:
 *           type: string
 *           description: Client UUID, required when creating a reminder.
 * /v1/admin/challenges/{challengeId}/emails:
 *   parameters:
 *     - $ref: '#/components/parameters/ChallengeEmailChallengeId'
 *   get:
 *     tags: [Challenges]
 *     summary: List upcoming reminders and recent email runs with delivery counts
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Data contains timezone and runs, including queued, sent, skipped, failed and pending counts. }
 *       403: { description: Classroom administration access required. }
 *       404: { description: Challenge not found in this organization. }
 *   post:
 *     tags: [Challenges]
 *     summary: Dispatch a challenge announcement or missing-decision reminder
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChallengeEmailSendInput' }
 *     responses:
 *       202: { description: Data contains runId. Consult send history for delivery status. }
 *       400: { description: Invalid audience or request key. }
 *       409: { description: Challenge unavailable or conflicting request key. }
 * /v1/admin/challenges/{challengeId}/emails/preview:
 *   parameters:
 *     - $ref: '#/components/parameters/ChallengeEmailChallengeId'
 *   post:
 *     tags: [Challenges]
 *     summary: Preview standard challenge email content and eligible recipient count
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChallengeEmailAudienceInput' }
 *     responses:
 *       200: { description: Subject, templateSlug, templateData, recipientCount, unavailable, deliveryDisabled and suppressed flags. }
 * /v1/admin/challenges/{challengeId}/reminders:
 *   parameters:
 *     - $ref: '#/components/parameters/ChallengeEmailChallengeId'
 *   post:
 *     tags: [Challenges]
 *     summary: Schedule a reminder for students with missing decisions
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/ChallengeReminderInput'
 *               - required: [requestKey]
 *     responses:
 *       201: { description: Reminder stored with UTC sendAt and classroom timezone. }
 *       400: { description: Invalid reminder date or request key. }
 *       409: { description: Submissions are closed. }
 * /v1/admin/challenges/{challengeId}/reminders/{reminderId}:
 *   parameters:
 *     - $ref: '#/components/parameters/ChallengeEmailChallengeId'
 *     - $ref: '#/components/parameters/ChallengeEmailReminderId'
 *   put:
 *     tags: [Challenges]
 *     summary: Change the time of a pending reminder
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChallengeReminderInput' }
 *     responses:
 *       200: { description: Updated reminder. }
 *       400: { description: Invalid reminder date. }
 *       409: { description: Reminder already started or unavailable. }
 *   delete:
 *     tags: [Challenges]
 *     summary: Cancel a pending reminder
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Cancelled reminder. }
 *       409: { description: Reminder already started or unavailable. }
 */
