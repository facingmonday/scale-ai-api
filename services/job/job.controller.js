const JobService = require("./lib/jobService");
const JobModel = require("./job.model");
const Classroom = require("../classroom/classroom.model");
const Challenge = require("../challenge/challenge.model");
const Decision = require("../decision/decision.model");
const LedgerEntry = require("../ledger/ledger.model");
const EvaluationReplacement = require("./evaluationReplacement.model");
const classroomReadinessService = require("../classroom/classroomReadiness.service");

function sendReadinessError(res, error) {
  if (
    !(error instanceof classroomReadinessService.ClassroomReadinessBlockedError)
  )
    return false;
  res.status(error.statusCode).json({
    error: error.message,
    code: error.code,
    readiness: error.readiness,
  });
  return true;
}

/**
 * Get jobs for a challenge
 * GET /api/admin/job/challenge/:challengeId
 */
exports.getJobsByScenario = async function (req, res) {
  try {
    const { challengeId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Find challenge to get classroomId
    const challenge = await Challenge.getScenarioById(
      challengeId,
      organizationId,
    );

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId,
    );

    const jobs = await JobModel.find({
      challengeId,
      organization: organizationId,
    })
      .populate("userId", "_id firstName lastName")
      .populate("replacementId")
      .sort({ userId: 1 });

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error("Error getting jobs:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get job by ID
 * GET /api/admin/job/:jobId
 */
exports.getJobById = async function (req, res) {
  try {
    const { jobId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    const job = await JobModel.findById(jobId)
      .populate("userId")
      .populate("decisionId")
      .populate("classroomId")
      .populate("challengeId");

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Find challenge to verify access
    const challenge = await Challenge.getScenarioById(
      job.challengeId._id,
      organizationId,
    );

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId,
    );

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("Error getting job:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Retry a failed job
 * POST /api/admin/job/:jobId/retry
 */
exports.retryJob = async function (req, res) {
  try {
    const { jobId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    const job = await JobService.getJobById(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Find challenge to verify access
    const challenge = await Challenge.getScenarioById(
      job.challengeId,
      organizationId,
    );

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId,
    );

    await classroomReadinessService.assertClassroomReady({
      classroomId: challenge.classroomId,
      challengeId: challenge._id,
      organizationId,
      operation: "rerun",
      ignoreCheckKeys: ["in_progress_jobs"],
    });

    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
    const apparentlyStuck =
      job.status === "running" &&
      job.simulationMode === "direct" &&
      job.startedAt &&
      job.startedAt <= staleBefore;
    if (job.status !== "failed" && !apparentlyStuck)
      return res.status(409).json({
        error:
          "Only failed or apparently stuck direct-processing jobs can be retried",
      });
    const processing = require("./lib/challengeProcessing");
    await processing.withChallengeLock(job.challengeId, async () => {
      const queued = await require("../../lib/queues").queues.simulation.getJob(
        processing.queueId(job),
      );
      if (
        queued &&
        ["active", "waiting", "delayed"].includes(await queued.getState())
      ) {
        throw Object.assign(new Error("Job retry is already active"), {
          statusCode: 409,
        });
      }
      if (queued) await queued.remove();
      const batchQueue = require("../../lib/queues").queues.simulationBatch;
      const submission = await batchQueue.getJob(
        `batch-submit:${job.challengeId}:${job.processingRunId || "legacy"}`,
      );
      if (
        submission &&
        ["failed", "completed"].includes(await submission.getState())
      )
        await submission.remove();
      await job.reset({
        preserveLedgerEntry: job.purpose === "replacement",
        actor: clerkUserId,
      });
      job.dispatchReserved = false;
      job.suppressNotifications = true;
      job.updatedBy = clerkUserId;
      await job.save();
      if (job.purpose === "replacement" && job.replacementId) {
        await EvaluationReplacement.updateOne(
          { _id: job.replacementId, state: "failed" },
          {
            $set: { state: "queued", error: null },
            $push: {
              events: {
                action: "retry_queued",
                at: new Date(),
                actor: clerkUserId,
              },
            },
          },
        );
      }
      if (job.purpose !== "replacement") {
        await Challenge.updateOne(
          { _id: job.challengeId, organization: organizationId },
          { $set: { automationStatus: "processing", automationError: null } },
        );
      }
    });
    if (job.purpose === "replacement") {
      await processing.enqueueReplacementJob(job._id);
    } else {
      await processing.enqueuePending(job.challengeId);
    }

    res.json({
      success: true,
      message: "Job queued for retry",
      data: job,
    });
  } catch (error) {
    console.error("Error retrying job:", error);
    if (sendReadinessError(res, error)) return;
    if (error.statusCode)
      return res.status(error.statusCode).json({ error: error.message });
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

async function loadAuthorizedDecision(req) {
  const { challengeId, decisionId } = req.params;
  const organizationId = req.organization._id;
  const challenge = await Challenge.getScenarioById(
    challengeId,
    organizationId,
  );
  if (!challenge) {
    throw Object.assign(new Error("Challenge not found"), { statusCode: 404 });
  }
  await Classroom.validateAdminAccess(
    challenge.classroomId,
    req.clerkUser.id,
    organizationId,
  );
  const decision = await Decision.findOne({
    _id: decisionId,
    challengeId,
    classroomId: challenge.classroomId,
    organization: organizationId,
  });
  if (!decision) {
    throw Object.assign(new Error("Student submission not found"), {
      statusCode: 404,
    });
  }
  return { challenge, decision };
}

/** Queue a silent replacement evaluation while retaining the published result. */
exports.rerunStudentEvaluation = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const { challenge, decision } = await loadAuthorizedDecision(req);
    const published = await LedgerEntry.findOne({
      _id: decision.ledgerEntryId,
      challengeId: challenge._id,
      userId: decision.userId,
      organization: organizationId,
    });
    if (!published || decision.processingStatus !== "completed") {
      return res.status(409).json({
        error: "A completed published evaluation is required before rerunning",
      });
    }
    await classroomReadinessService.assertClassroomReady({
      classroomId: challenge.classroomId,
      challengeId: challenge._id,
      organizationId,
      operation: "rerun",
      ignoreCheckKeys: ["in_progress_jobs"],
    });

    const processing = require("./lib/challengeProcessing");
    const result = await processing.withChallengeLock(
      challenge._id,
      async () => {
        const activeKey = `${challenge._id}:${decision.userId}`;
        let replacement = await EvaluationReplacement.findOne({
          activeKey,
          organization: organizationId,
        });
        if (replacement && replacement.state !== "failed") {
          const existingJob = replacement.jobId
            ? await JobModel.findById(replacement.jobId)
            : null;
          return { replacement, job: existingJob, existing: true };
        }

        let job = await JobModel.findOne({
          challengeId: challenge._id,
          userId: decision.userId,
          organization: organizationId,
        });
        if (job && ["pending", "running"].includes(job.status)) {
          throw Object.assign(
            new Error("An evaluation is already active for this student"),
            {
              statusCode: 409,
            },
          );
        }

        if (!replacement) {
          replacement = await EvaluationReplacement.create({
            classroomId: challenge.classroomId,
            challengeId: challenge._id,
            decisionId: decision._id,
            userId: decision.userId,
            publishedLedgerEntryId: published._id,
            state: "queued",
            activeKey,
            originalResult: published.toObject(),
            events: [{ action: "rerun_requested", actor: clerkUserId }],
            organization: organizationId,
            createdBy: clerkUserId,
            updatedBy: clerkUserId,
          });
        } else {
          replacement.state = "queued";
          replacement.error = null;
          replacement.result = null;
          replacement.record("rerun_requested", clerkUserId, { retry: true });
          replacement.updatedBy = clerkUserId;
          await replacement.save();
        }

        if (!job) {
          job = new JobModel({
            classroomId: challenge.classroomId,
            challengeId: challenge._id,
            decisionId: decision._id,
            userId: decision.userId,
            organization: organizationId,
            createdBy: clerkUserId,
            updatedBy: clerkUserId,
          });
        }
        job.purpose = "replacement";
        job.replacementId = replacement._id;
        job.processingRunId = `replacement:${replacement._id}`;
        job.simulationMode = "direct";
        job.simulationConcurrency = 1;
        job.status = "pending";
        job.dispatchReserved = false;
        job.startedAt = null;
        job.completedAt = null;
        job.error = null;
        job.openaiRequest = null;
        job.openaiRequestRawMessages = null;
        job.openaiRequestPreparedAt = null;
        job.calculationContextSnapshot = null;
      job.ledgerCompletionTracking = false;
      job.suppressNotifications = true;
        job.ledgerCompletionReconciledAt = null;
        job.updatedBy = clerkUserId;
        job.history.push({ action: "replacement_queued", actor: clerkUserId });
        await job.save();
        replacement.jobId = job._id;
        await replacement.save();
        return { replacement, job, existing: false };
      },
    );

    if (!result.existing)
      await processing.enqueueReplacementJob(result.job._id);
    return res.status(result.existing ? 200 : 202).json({
      success: true,
      message: result.existing
        ? "Replacement evaluation is already active"
        : "Silent replacement evaluation queued for manual review",
      data: result,
    });
  } catch (error) {
    console.error("Error rerunning student evaluation:", error);
    if (sendReadinessError(res, error)) return;
    if (error.statusCode)
      return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "A replacement evaluation is already active" });
    }
    res.status(500).json({ error: error.message });
  }
};

async function loadAuthorizedReplacement(req) {
  const replacement = await EvaluationReplacement.findOne({
    _id: req.params.replacementId,
    organization: req.organization._id,
  });
  if (!replacement) {
    throw Object.assign(new Error("Replacement evaluation not found"), {
      statusCode: 404,
    });
  }
  const challenge = await Challenge.getScenarioById(
    replacement.challengeId,
    req.organization._id,
  );
  if (!challenge) {
    throw Object.assign(new Error("Challenge not found"), { statusCode: 404 });
  }
  await Classroom.validateAdminAccess(
    challenge.classroomId,
    req.clerkUser.id,
    req.organization._id,
  );
  return replacement;
}

exports.publishReplacement = async function (req, res) {
  try {
    const replacement = await loadAuthorizedReplacement(req);
    if (replacement.state === "published") {
      return res.json({
        success: true,
        data: replacement,
        message: "Replacement already published",
      });
    }
    if (replacement.state !== "draft" || !replacement.result) {
      return res
        .status(409)
        .json({ error: "Only a completed draft can be published" });
    }
    const input = replacement.result;
    const updated = await LedgerEntry.findOneAndUpdate(
      {
        _id: replacement.publishedLedgerEntryId,
        organization: req.organization._id,
      },
      {
        $set: {
          profileId: input.profileId || null,
          metrics: input.metrics || {},
          randomEvent: input.randomEvent || null,
          summary: input.summary,
          studentFeedback: input.studentFeedback,
          aiMetadata: input.aiMetadata,
          calculationContext: input.calculationContext,
          updatedBy: req.clerkUser.id,
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated)
      return res
        .status(409)
        .json({ error: "Published result no longer exists" });
    replacement.state = "published";
    replacement.publishedAt = new Date();
    replacement.activeKey = undefined;
    replacement.record("replacement_published", req.clerkUser.id, {
      notificationSent: false,
    });
    replacement.updatedBy = req.clerkUser.id;
    await replacement.save();
    res.json({
      success: true,
      message: "Replacement published. The student has not been notified.",
      data: { replacement, ledgerEntry: updated },
    });
  } catch (error) {
    console.error("Error publishing replacement:", error);
    if (error.statusCode)
      return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

exports.discardReplacement = async function (req, res) {
  try {
    const replacement = await loadAuthorizedReplacement(req);
    if (replacement.state === "discarded") {
      return res.json({
        success: true,
        data: replacement,
        message: "Replacement already discarded",
      });
    }
    if (!["draft", "failed"].includes(replacement.state)) {
      return res
        .status(409)
        .json({ error: "Only a draft or failed replacement can be discarded" });
    }
    replacement.state = "discarded";
    replacement.discardedAt = new Date();
    replacement.activeKey = undefined;
    replacement.record("replacement_discarded", req.clerkUser.id);
    replacement.updatedBy = req.clerkUser.id;
    await replacement.save();
    res.json({
      success: true,
      message: "Replacement discarded; published result retained",
      data: replacement,
    });
  } catch (error) {
    console.error("Error discarding replacement:", error);
    if (error.statusCode)
      return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

exports.notifyReplacement = async function (req, res) {
  try {
    const replacement = await loadAuthorizedReplacement(req);
    if (replacement.state !== "published") {
      return res
        .status(409)
        .json({
          error: "Publish the replacement before notifying the student",
        });
    }
    if (replacement.notifiedAt) {
      return res.json({
        success: true,
        data: replacement,
        message: "Student already notified",
      });
    }
    await LedgerEntry.sendResultNotification(
      replacement.publishedLedgerEntryId,
    );
    replacement.notifiedAt = new Date();
    replacement.record("student_notified", req.clerkUser.id);
    replacement.updatedBy = req.clerkUser.id;
    await replacement.save();
    res.json({
      success: true,
      message: "Student notification queued",
      data: replacement,
    });
  } catch (error) {
    console.error("Error notifying student about replacement:", error);
    if (error.statusCode)
      return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

/**
 * Process pending jobs (admin endpoint for manual triggering)
 * POST /api/admin/job/process-pending
 */
exports.processPendingJobs = async function (req, res) {
  try {
    const { limit = 10, challengeId = null } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Verify admin access (any class)
    // This is a system-level operation, so we'll allow org admins
    // In production, you might want to add additional checks

    const pendingQuery = {
      status: "pending",
      dryRun: false,
      organization: organizationId,
    };
    if (challengeId) pendingQuery.challengeId = challengeId;
    const pending = await JobModel.find(pendingQuery)
      .sort({ createdDate: 1 })
      .limit(Math.min(100, Math.max(1, Number(limit) || 10)));
    const results = [];
    const processing = require("./lib/challengeProcessing");
    for (const job of pending.filter((item) => item.purpose === "replacement")) {
      await Classroom.validateAdminAccess(
        job.classroomId,
        clerkUserId,
        organizationId,
      );
      await processing.enqueueReplacementJob(job._id);
      results.push({
        success: true,
        challengeId: String(job.challengeId),
        jobId: String(job._id),
        replacement: true,
        queued: true,
      });
    }
    for (const challengeId of new Set(
      pending
        .filter((job) => job.purpose !== "replacement")
        .map((job) => String(job.challengeId)),
    )) {
      const job = pending.find(
        (item) => String(item.challengeId) === challengeId,
      );
      await Classroom.validateAdminAccess(
        job.classroomId,
        clerkUserId,
        organizationId,
      );
      await classroomReadinessService.assertClassroomReady({
        classroomId: job.classroomId,
        challengeId,
        organizationId,
        operation: "process",
        ignoreCheckKeys: ["in_progress_jobs"],
      });
      await processing.enqueuePending(challengeId);
      results.push({ success: true, challengeId, queued: true });
    }

    res.json({
      success: true,
      message: `Queued processing for ${results.length} challenges`,
      data: results,
    });
  } catch (error) {
    console.error("Error processing pending jobs:", error);
    if (sendReadinessError(res, error)) return;
    if (error.statusCode)
      return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};
