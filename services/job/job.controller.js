const JobService = require("./lib/jobService");
const JobModel = require("./job.model");
const SimulationWorker = require("./lib/simulationWorker");
const Classroom = require("../classroom/classroom.model");
const Challenge = require("../challenge/challenge.model");
const {
  enqueueSimulationBatchSubmit,
} = require("../../lib/queues/simulation-batch-worker");
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
    const challenge = await Challenge.getScenarioById(challengeId, organizationId);

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
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
      organizationId
    );

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
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
      organizationId
    );

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Verify admin access
    await Classroom.validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId
    );

    await assertClassroomReady({
      classroomId: challenge.classroomId,
      challengeId: challenge._id,
      organizationId,
      operation: "rerun",
      ignoreCheckKeys: ["in_progress_jobs"],
    });

    // Reset and process job
    await job.reset();

    const simulationMode = String(process.env.SIMULATION_MODE || "direct");
    const useBatch = simulationMode === "batch";

    if (useBatch) {
      // Re-submit as a (small) batch: submit all pending jobs for this challenge.
      await enqueueSimulationBatchSubmit({
        challengeId: job.challengeId,
        classroomId: job.classroomId,
        organizationId,
        clerkUserId,
      });
    } else {
      // Process job asynchronously (direct mode)
      SimulationWorker.processJob(jobId).catch((error) => {
        console.error(`Error processing job ${jobId} after retry:`, error);
      });
    }

    res.json({
      success: true,
      message: "Job queued for retry",
      data: job,
    });
  } catch (error) {
    console.error("Error retrying job:", error);
    if (sendReadinessError(res, error)) return;
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

    const simulationMode = String(process.env.SIMULATION_MODE || "direct");
    const useBatch = simulationMode === "batch";

    let results;
    if (useBatch) {
      // In batch mode, submit batches per challenge for pending jobs (up to limit jobs total).
      const pending = await JobModel.find({ status: "pending" })
        .sort({ createdDate: 1 })
        .limit(limit);

      const byScenario = new Map();
      for (const j of pending) {
        const key = String(j.challengeId);
        if (!byScenario.has(key)) byScenario.set(key, j);
      }

      const enqueued = [];
      for (const [, j] of byScenario) {
        await assertClassroomReady({
          classroomId: j.classroomId,
          challengeId: j.challengeId,
          organizationId: j.organization,
          operation: "process",
          ignoreCheckKeys: ["in_progress_jobs"],
        });
        await enqueueSimulationBatchSubmit({
          challengeId: j.challengeId,
          classroomId: j.classroomId,
          organizationId: j.organization,
          clerkUserId,
        });
        enqueued.push({ challengeId: j.challengeId, classroomId: j.classroomId });
      }
      results = enqueued.map((x) => ({ success: true, ...x }));
    } else {
      const pending = await JobModel.find({ status: "pending" })
        .sort({ createdDate: 1 })
        .limit(limit);
      const readyJobIds = [];
      const blockedResults = [];

      for (const job of pending) {
        try {
          await assertClassroomReady({
            classroomId: job.classroomId,
            challengeId: job.challengeId,
            organizationId: job.organization,
            operation: "process",
            ignoreCheckKeys: ["in_progress_jobs"],
          });
          readyJobIds.push(job._id);
        } catch (error) {
          if (!(error instanceof ClassroomReadinessBlockedError)) throw error;
          blockedResults.push({
            success: false,
            jobId: job._id,
            code: error.code,
            error: error.message,
            readiness: error.readiness,
          });
        }
      }

      const processed = [];
      for (const jobId of readyJobIds) {
        try {
          processed.push(await SimulationWorker.processJob(jobId));
        } catch (error) {
          processed.push({
            success: false,
            jobId,
            error: error.message,
          });
        }
      }
      results = [...processed, ...blockedResults];
    }

    res.json({
      success: true,
      message: `Processed ${results.length} jobs`,
      data: results,
    });
  } catch (error) {
    console.error("Error processing pending jobs:", error);
    if (sendReadinessError(res, error)) return;
    res.status(500).json({ error: error.message });
  }
};
