const JobService = require("./lib/jobService");
const JobModel = require("./job.model");
const Classroom = require("../classroom/classroom.model");
const Challenge = require("../challenge/challenge.model");
const {
  assertClassroomReady,
  ClassroomReadinessBlockedError,
} = require("../classroom/classroomReadiness.service");

function sendReadinessError(res, error) {
  if (!(error instanceof ClassroomReadinessBlockedError)) return false;
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

    const jobs = await JobService.getJobsByScenario(challengeId);

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

    await assertClassroomReady({
      classroomId: challenge.classroomId,
      challengeId: challenge._id,
      organizationId,
      operation: "rerun",
      ignoreCheckKeys: ["in_progress_jobs"],
    });

    if (job.status !== "failed")
      return res.status(409).json({ error: "Only failed jobs can be retried" });
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
      await job.reset();
      job.dispatchReserved = false;
      await job.save();
      await Challenge.updateOne(
        { _id: job.challengeId, organization: organizationId },
        { $set: { automationStatus: "processing", automationError: null } },
      );
    });
    await processing.enqueuePending(job.challengeId);

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

/**
 * Process pending jobs (admin endpoint for manual triggering)
 * POST /api/admin/job/process-pending
 */
exports.processPendingJobs = async function (req, res) {
  try {
    const { limit = 10 } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Verify admin access (any class)
    // This is a system-level operation, so we'll allow org admins
    // In production, you might want to add additional checks

    const pending = await JobModel.find({
      status: "pending",
      dryRun: false,
      organization: organizationId,
    })
      .sort({ createdDate: 1 })
      .limit(Math.min(100, Math.max(1, Number(limit) || 10)));
    const results = [];
    for (const challengeId of new Set(
      pending.map((job) => String(job.challengeId)),
    )) {
      const job = pending.find(
        (item) => String(item.challengeId) === challengeId,
      );
      await Classroom.validateAdminAccess(
        job.classroomId,
        clerkUserId,
        organizationId,
      );
      await assertClassroomReady({
        classroomId: job.classroomId,
        challengeId,
        organizationId,
        operation: "process",
        ignoreCheckKeys: ["in_progress_jobs"],
      });
      await require("./lib/challengeProcessing").enqueuePending(challengeId);
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
