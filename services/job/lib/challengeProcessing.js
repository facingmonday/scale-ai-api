const { randomUUID } = require("node:crypto");
const Challenge = require("../../challenge/challenge.model");
const SimulationJob = require("../job.model");
const { queues, ensureQueueReady } = require("../../../lib/queues");
const {
  getProcessingSettings,
  validateProcessingSettings,
} = require("../../challenge/lib/processingSettings");

const busy = () =>
  Object.assign(
    new Error("Result processing is active. Try again after it finishes."),
    { statusCode: 409 },
  );
const queueId = (job) =>
  `simulation:${job._id}:${job.processingRunId || "legacy"}`;

// Shared by settings edits, run creation, dispatch and batch ingestion. The lease
// is renewed while held; reservations themselves are durable MongoDB records.
async function withChallengeLock(challengeId, action, { waitMs = 0 } = {}) {
  await ensureQueueReady(queues.simulation, "simulation");
  const redis = await queues.simulation.client;
  const key = `${queues.simulation.toKey("challenge-lock")}:${challengeId}`;
  const token = randomUUID();
  const deadline = Date.now() + waitMs;
  while ((await redis.set(key, token, "PX", 60000, "NX")) !== "OK") {
    if (Date.now() >= deadline) throw busy();
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  let lost = false;
  const timer = setInterval(() => {
    redis
      .eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], 60000) else return 0 end',
        1,
        key,
        token,
      )
      .then((renewed) => {
        if (!renewed) lost = true;
      })
      .catch(() => {
        lost = true;
      });
  }, 15000);
  timer.unref();
  try {
    return await action(() => {
      if (lost) throw new Error("Challenge processing lease lost");
    });
  } finally {
    clearInterval(timer);
    await redis.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      1,
      key,
      token,
    );
  }
}

async function hasActiveWork(challenge) {
  const Batch = require("../simulationBatch.model");
  const processingRunId = challenge.processingRun?.id || null;
  return (
    challenge.processingRun?.preparing ||
    challenge.automationStatus === "queuedForProcessing" ||
    (["processing", "PROCESSING"].includes(challenge.automationStatus) &&
      !challenge.processingRun?.id) ||
    (await SimulationJob.exists({
      challengeId: challenge._id,
      dryRun: false,
      $or: [
        { status: { $in: ["pending", "running"] } },
        { dispatchReserved: true },
      ],
    })) ||
    (await Batch.exists({
      challengeId: challenge._id,
      // A cancelled/reopened challenge clears processingRun. Do not let a
      // superseded batch from the previous run permanently lock settings.
      // Legacy runs without an id still match null/missing processingRunId.
      processingRunId,
      status: {
        $in: [
          "created",
          "submitted",
          "validating",
          "in_progress",
          "finalizing",
          "cancelling",
        ],
      },
    }))
  );
}

async function updateSettings(challengeId, organizationId, clerkUserId, input) {
  const settings = validateProcessingSettings(input, { partial: true });
  if (!Object.keys(settings).length)
    throw Object.assign(new Error("Provide processing settings"), {
      statusCode: 400,
    });
  return withChallengeLock(challengeId, async () => {
    const challenge = await Challenge.findOne({
      _id: challengeId,
      organization: organizationId,
    });
    if (!challenge)
      throw Object.assign(new Error("Challenge not found"), {
        statusCode: 404,
      });
    await require("../../classroom/classroom.model").validateAdminAccess(
      challenge.classroomId,
      clerkUserId,
      organizationId,
    );
    if (await hasActiveWork(challenge)) throw busy();
    return Challenge.findOneAndUpdate(
      { _id: challengeId, organization: organizationId },
      { $set: { ...settings, updatedBy: clerkUserId } },
      { new: true, runValidators: true },
    );
  });
}

async function addReservedJob(job) {
  const id = queueId(job);
  const existing = await queues.simulation.getJob(id);
  if (existing) {
    const state = await existing.getState();
    if (state === "failed" || state === "completed") await existing.remove();
    else return;
  }
  await queues.simulation.add(
    {
      jobId: String(job._id),
      challengeId: String(job.challengeId),
      processingRunId: job.processingRunId,
    },
    {
      jobId: id,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
}

async function dispatchLocked(challenge, assertLease = () => {}) {
  if (challenge.processingRun?.preparing) return 0;
  const mode =
    challenge.processingRun?.mode ||
    getProcessingSettings(challenge).simulationMode;
  if (mode !== "direct") return 0;
  const runId = challenge.processingRun?.id || null;
  const query = {
    challengeId: challenge._id,
    dryRun: false,
    processingRunId: runId,
  };
  // Terminal reservations are released only after Bull has settled; this also
  // lets Bull retry lifecycle reconciliation without rerunning the calculation.
  const reserved = await SimulationJob.find({
    ...query,
    dispatchReserved: true,
  });
  for (const job of reserved) {
    const queued = await queues.simulation.getJob(queueId(job));
    const state = queued ? await queued.getState() : "unknown";
    assertLease();
    if (["active", "waiting", "delayed", "paused"].includes(state)) continue;
    if (["completed", "failed"].includes(job.status)) {
      await SimulationJob.updateOne(
        { _id: job._id, processingRunId: runId },
        { $set: { dispatchReserved: false } },
      );
    } else if (state === "failed") {
      await job.markFailed(
        queued.failedReason || "Simulation queue attempts exhausted",
      );
      await require("./simulationWorker").updateSubmissionStatus(job, "failed");
      await require("./simulationWorker").recordLedgerCompletionEvents(job);
      await SimulationJob.updateOne(
        { _id: job._id, processingRunId: runId },
        { $set: { dispatchReserved: false } },
      );
    } else {
      // A missing queue record after a restart/enqueue failure is recoverable.
      if (job.status === "running") {
        job.status = "pending";
        await job.save();
      }
      await addReservedJob(job);
    }
  }
  if (
    !(await SimulationJob.exists({
      ...query,
      status: { $in: ["pending", "running"] },
    })) &&
    (await SimulationJob.exists({ ...query, status: "failed" }))
  ) {
    await Challenge.updateOne(
      { _id: challenge._id, "processingRun.id": runId },
      {
        $set: {
          automationStatus: "FAILED",
          automationError:
            "Some student calculations failed. Retry the failed jobs or rerun the challenge.",
        },
      },
    );
  }
  const occupied = await SimulationJob.countDocuments({
    ...query,
    dispatchReserved: true,
  });
  const limit =
    challenge.processingRun?.concurrency ||
    getProcessingSettings(challenge).simulationConcurrency;
  const slots = Math.max(0, limit - occupied);
  if (!slots) return 0;
  const pending = await SimulationJob.find({
    ...query,
    status: "pending",
    dispatchReserved: { $ne: true },
  })
    .sort({ createdDate: 1, _id: 1 })
    .limit(slots);
  for (const job of pending) {
    assertLease();
    await SimulationJob.updateOne(
      { _id: job._id, processingRunId: runId, status: "pending" },
      { $set: { dispatchReserved: true } },
    );
    await addReservedJob(job);
  }
  return pending.length;
}

async function dispatchChallenge(challengeId) {
  return withChallengeLock(challengeId, async (assertLease) => {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return 0;
    return dispatchLocked(challenge, assertLease);
  });
}

async function startChallenge({
  challengeId,
  organizationId,
  clerkUserId,
  rerun = false,
  cancelBatch = false,
  replacementSettings = null,
}) {
  return withChallengeLock(
    challengeId,
    async (assertLease) => {
      const challenge = await Challenge.findOne({
        _id: challengeId,
        organization: organizationId,
      });
      if (!challenge)
        throw Object.assign(new Error("Challenge not found"), {
          statusCode: 404,
        });
      const JobService = require("./jobService");
      const existingRun = challenge.processingRun;
      const resuming = !!existingRun?.preparing;
      if (!resuming && !rerun && existingRun?.id) {
        if (
          existingRun.mode === "batch" &&
          (await SimulationJob.exists({
            challengeId,
            processingRunId: existingRun.id,
            status: "pending",
          }))
        ) {
          await require("../../../lib/queues/simulation-batch-worker").enqueueSimulationBatchSubmit(
            {
              challengeId,
              classroomId: challenge.classroomId,
              organizationId,
              clerkUserId,
              processingRunId: existingRun.id,
            },
          );
        } else await dispatchLocked(challenge, assertLease);
        return SimulationJob.find({
          challengeId,
          processingRunId: existingRun.id,
        });
      }
      if (!resuming && rerun) {
        if (cancelBatch) {
          // Hold the same lock as batch submission/ingestion; no old ingestion can
          // overlap resetting the jobs and their stored batch ownership.
          if (
            await SimulationJob.exists({
              challengeId,
              simulationMode: "direct",
              status: { $in: ["pending", "running"] },
            })
          )
            throw busy();
          await require("../simulationBatch.model").cancelInProgressBatchForScenario(
            challengeId,
            organizationId,
          );
          if (replacementSettings && Object.keys(replacementSettings).length) {
            const settings = validateProcessingSettings(replacementSettings, {
              partial: true,
            });
            Object.assign(challenge, settings);
            await challenge.save();
          }
        } else if (await hasActiveWork(challenge)) throw busy();
      }
      if (!resuming) {
        const settings = getProcessingSettings(challenge);
        challenge.processingRun = {
          id: randomUUID(),
          mode: settings.simulationMode,
          concurrency: settings.simulationConcurrency,
          preparing: true,
          resetPending: rerun,
        };
        await challenge.save();
      }
      if (challenge.processingRun.resetPending) {
        await require("../../challenge/lib/challengeDebriefService").resetChallengeDebriefForRerun(
          { challengeId, organizationId },
        );
        await require("../../ledger/ledger.model").deleteLedgerEntriesForScenario(
          challengeId,
        );
        challenge.processingRun.resetPending = false;
        await challenge.save();
      }

      assertLease();
      const run = challenge.processingRun;
      const jobs = await JobService.createJobsForScenario(
        challengeId,
        challenge.classroomId,
        false,
        organizationId,
        clerkUserId,
        {
          enqueue: false,
          processingRunId: run.id,
          simulationMode: run.mode,
          simulationConcurrency: run.concurrency,
          preserveExisting: true,
        },
      );
      await challenge.beginResultCalculation(clerkUserId);
      challenge.processingRun.preparing = false;
      await challenge.save();
      assertLease();
      if (run.mode === "batch" && jobs.length) {
        await require("../../../lib/queues/simulation-batch-worker").enqueueSimulationBatchSubmit(
          {
            challengeId,
            classroomId: challenge.classroomId,
            organizationId,
            clerkUserId,
            processingRunId: run.id,
          },
        );
      } else await dispatchLocked(challenge, assertLease);
      await require("../ledgerCompletionEvent.model").recordChallengeLedgersComplete(
        challengeId,
      );
      return jobs;
    },
    { waitMs: 5000 },
  );
}

async function enqueuePending(challengeId) {
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) throw new Error("Challenge not found");
  const mode =
    challenge.processingRun?.mode ||
    getProcessingSettings(challenge).simulationMode;
  if (challenge.processingRun?.preparing) return 0;
  if (mode === "batch") {
    if (
      !(await SimulationJob.exists({
        challengeId,
        status: "pending",
        dryRun: false,
      }))
    )
      return 0;
    return require("../../../lib/queues/simulation-batch-worker").enqueueSimulationBatchSubmit(
      {
        challengeId,
        classroomId: challenge.classroomId,
        organizationId: challenge.organization,
        clerkUserId: challenge.updatedBy || challenge.createdBy,
        processingRunId: challenge.processingRun?.id,
      },
    );
  }
  return dispatchChallenge(challengeId);
}

async function recoverDispatch() {
  const ids = await SimulationJob.distinct("challengeId", {
    dryRun: false,
    simulationMode: { $in: ["direct", "batch"] },
    $or: [
      { status: { $in: ["pending", "running"] } },
      { dispatchReserved: true },
    ],
  });
  for (const id of ids) {
    try {
      await enqueuePending(id);
    } catch (error) {
      if (error.statusCode !== 409)
        console.error(
          "Simulation dispatch recovery failed:",
          id,
          error.message,
        );
    }
  }
}

module.exports = {
  withChallengeLock,
  hasActiveWork,
  updateSettings,
  startChallenge,
  dispatchChallenge,
  dispatchLocked,
  enqueuePending,
  recoverDispatch,
  queueId,
};
