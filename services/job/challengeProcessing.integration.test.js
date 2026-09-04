const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { spawn } = require("node:child_process");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");
let redis, processing, queues, Challenge, Job, Classroom, SimulationWorker;
let processImplementation;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate) {
  const deadline = Date.now() + 15000;
  while (!(await predicate())) {
    if (Date.now() > deadline)
      throw new Error("Timed out waiting for simulation jobs");
    await sleep(20);
  }
}

before(async () => {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  Object.assign(process.env, {
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: String(port),
    REDIS_TLS: "false",
    REDIS_DB: "0",
    SEND_EMAIL: "false",
  });
  delete process.env.REDIS_USERNAME;
  delete process.env.REDIS_PASSWORD;
  const childEnv = { ...process.env };
  delete childEnv.NODE_CHANNEL_FD;
  delete childEnv.NODE_UNIQUE_ID;
  redis = spawn(
    "redis-server",
    [
      "--port",
      String(port),
      "--bind",
      "127.0.0.1",
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: ["ignore", "pipe", "pipe"], env: childEnv },
  );
  await new Promise((resolve, reject) => {
    redis.once("error", reject);
    redis.stdout.on("data", (data) => {
      if (String(data).includes("Ready to accept connections")) resolve();
    });
    redis.once("exit", (code) =>
      reject(new Error(`Test Redis exited: ${code}`)),
    );
  });
  await setupTestDb();
  processing = require("./lib/challengeProcessing");
  ({ queues } = require("../../lib/queues"));
  Challenge = require("../challenge/challenge.model");
  Job = require("./job.model");
  Classroom = require("../classroom/classroom.model");
  SimulationWorker = require("./lib/simulationWorker");
  SimulationWorker.processJob = (...args) => processImplementation(...args);
  require("../../lib/queues/simulation-worker").initSimulationWorker();
});

after(async () => {
  if (queues)
    await Promise.all(Object.values(queues).map((queue) => queue.close()));
  await teardownTestDb();
  if (redis) {
    redis.kill("SIGTERM");
    await new Promise((resolve) => redis.once("exit", resolve));
  }
});

beforeEach(async () => {
  await queues.simulation.pause(true);
  await until(async () => (await queues.simulation.getActive()).length === 0);
  await queues.simulation.empty();
  await queues.simulation.clean(0, "failed");
  await clearCollections();
});

async function fixture(count, concurrency = 5) {
  const organization = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const challenge = await Challenge.create({
    classroomId,
    organization,
    title: "Mock calculation",
    simulationMode: "direct",
    simulationConcurrency: concurrency,
    processingRun: {
      id: String(new mongoose.Types.ObjectId()),
      mode: "direct",
      concurrency,
      preparing: false,
    },
    isClosed: true,
    automationStatus: "processing",
    createdBy: "admin",
    updatedBy: "admin",
  });
  const jobs = await Job.insertMany(
    Array.from({ length: count }, () => ({
      classroomId,
      organization,
      challengeId: challenge._id,
      userId: new mongoose.Types.ObjectId(),
      processingRunId: challenge.processingRun.id,
      simulationMode: "direct",
      simulationConcurrency: concurrency,
      createdBy: "admin",
      updatedBy: "admin",
    })),
  );
  return { challenge, jobs, organization };
}

function successfulProcessor({
  hold,
  counts = new Map(),
  peaks = new Map(),
  starts = [],
} = {}) {
  processImplementation = async (id) => {
    const job = await Job.findById(id);
    const key = String(job.challengeId);
    counts.set(key, (counts.get(key) || 0) + 1);
    peaks.set(key, Math.max(peaks.get(key) || 0, counts.get(key)));
    starts.push(String(id));
    await job.markRunning();
    if (hold) await hold(job);
    else await sleep(40);
    await job.markCompleted();
    counts.set(key, counts.get(key) - 1);
    return { success: true };
  };
  return { counts, peaks, starts };
}

async function settled(challengeId) {
  await until(
    async () =>
      !(await Job.exists({
        challengeId,
        $or: [
          { status: { $in: ["pending", "running"] } },
          { dispatchReserved: true },
        ],
      })),
  );
}

test("new challenges default to individual; stored legacy documents hydrate as batch", async () => {
  const fresh = new Challenge({ title: "New" });
  assert.equal(fresh.simulationMode, "direct");
  assert.equal(fresh.simulationConcurrency, 5);
  const legacy = Challenge.hydrate({
    _id: new mongoose.Types.ObjectId(),
    title: "Legacy",
  });
  assert.equal(legacy.simulationMode, "batch");
  assert.equal(
    require("../challenge/lib/processingSettings").getProcessingSettings({})
      .simulationMode,
    "batch",
  );
});

test("12 students use five slots, refilling after one finishes rather than waiting for all five", async () => {
  const { challenge, jobs } = await fixture(12);
  const gates = new Map();
  const stats = successfulProcessor({
    hold: (job) =>
      new Promise((resolve) => gates.set(String(job._id), resolve)),
  });
  await processing.dispatchChallenge(challenge._id);
  assert.equal(await Job.countDocuments({ dispatchReserved: true }), 5);
  await queues.simulation.resume(true);
  await until(() => gates.size === 5);
  const first = stats.starts[0];
  gates.get(first)();
  await until(() => gates.size === 6);
  assert.equal(stats.starts.length, 6);
  assert.equal(stats.peaks.get(String(challenge._id)), 5);
  processImplementation = async (id) => {
    const job = await Job.findById(id);
    await job.markCompleted();
    return { success: true };
  };
  for (const release of gates.values()) release();
  await settled(challenge._id);
  assert.equal(await Job.countDocuments({ status: "completed" }), jobs.length);
});

test("independent challenges enforce limits under competing dispatcher calls", async () => {
  const first = await fixture(9, 2);
  const second = await fixture(12, 5);
  const stats = successfulProcessor();
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, (_, index) =>
      processing.dispatchChallenge(
        index % 2 ? first.challenge._id : second.challenge._id,
      ),
    ),
  );
  assert.ok(results.some((item) => item.status === "fulfilled"));
  for (const item of results)
    if (item.status === "rejected") assert.equal(item.reason.statusCode, 409);
  await queues.simulation.resume(true);
  await Promise.all([
    settled(first.challenge._id),
    settled(second.challenge._id),
  ]);
  assert.equal(stats.peaks.get(String(first.challenge._id)), 2);
  assert.equal(stats.peaks.get(String(second.challenge._id)), 5);
});

test("retry backoff retains its slot and does not start another student early", async () => {
  const { challenge, jobs } = await fixture(2, 1);
  let attempts = 0;
  const starts = [];
  processImplementation = async (id) => {
    starts.push(String(id));
    const job = await Job.findById(id);
    if (++attempts === 1) {
      job.status = "pending";
      await job.save();
      throw new Error("Temporary upstream failure");
    }
    await job.markCompleted();
    return { success: true };
  };
  await processing.dispatchChallenge(challenge._id);
  await queues.simulation.resume(true);
  await until(() => attempts === 1);
  await sleep(100);
  assert.equal(starts.length, 1);
  assert.equal(await Job.countDocuments({ dispatchReserved: true }), 1);
  assert.equal((await Job.findById(jobs[0]._id)).status, "pending");
  await settled(challenge._id);
  assert.equal(starts[0], starts[1]);
  assert.equal(starts.length, jobs.length + 1);
});

test("restart recovery restores a durable reservation whose queue record was lost", async () => {
  const { challenge, jobs } = await fixture(3, 1);
  successfulProcessor();
  await Job.updateOne(
    { _id: jobs[0]._id },
    { $set: { dispatchReserved: true, status: "running" } },
  );
  await processing.recoverDispatch();
  assert.equal(await Job.countDocuments({ dispatchReserved: true }), 1);
  assert.ok(await queues.simulation.getJob(processing.queueId(jobs[0])));
  await queues.simulation.resume(true);
  await settled(challenge._id);
});

test("stopping a calculation cancels database jobs and removes queued work", async () => {
  const JobService = require("./lib/jobService");
  const { challenge, jobs, organization } = await fixture(1);
  await processing.dispatchChallenge(challenge._id);
  assert.ok(await queues.simulation.getJob(processing.queueId(jobs[0])));

  const result = await JobService.cancelJobsForScenario(
    challenge._id,
    organization,
  );

  assert.equal(result.total, 1);
  assert.equal(result.removed, 1);
  assert.equal((await Job.findById(jobs[0]._id)).status, "cancelled");
  assert.equal(await queues.simulation.getJob(processing.queueId(jobs[0])), null);
});

test("settings are authorized, locked during processing, and editable after completion", async (t) => {
  const { challenge, jobs, organization } = await fixture(1);
  const original = Classroom.validateAdminAccess;
  t.after(() => {
    Classroom.validateAdminAccess = original;
  });
  Classroom.validateAdminAccess = async (_classroomId, actor, org) => {
    assert.equal(String(org), String(organization));
    if (actor !== "admin") throw new Error("Insufficient permissions");
  };
  await assert.rejects(
    processing.updateSettings(challenge._id, organization, "other", {
      simulationMode: "batch",
    }),
    /Insufficient permissions/,
  );
  await assert.rejects(
    processing.updateSettings(
      challenge._id,
      new mongoose.Types.ObjectId(),
      "admin",
      { simulationMode: "batch" },
    ),
    { statusCode: 404 },
  );
  await assert.rejects(
    processing.updateSettings(challenge._id, organization, "admin", {
      simulationMode: "batch",
    }),
    { statusCode: 409 },
  );
  await jobs[0].markCompleted();
  await Challenge.updateOne(
    { _id: challenge._id },
    { $set: { automationStatus: "processed" } },
  );
  const updated = await processing.updateSettings(
    challenge._id,
    organization,
    "admin",
    { simulationMode: "batch", simulationConcurrency: 3 },
  );
  assert.equal(updated.simulationMode, "batch");
  assert.equal(updated.simulationConcurrency, 3);
  assert.equal(
    updated.processingRun.mode,
    "direct",
    "Existing run snapshot is unchanged",
  );
});

test("a superseded batch does not lock settings after a challenge is reopened", async (t) => {
  const Batch = require("./simulationBatch.model");
  const { challenge, organization } = await fixture(0);
  const original = Classroom.validateAdminAccess;
  t.after(() => {
    Classroom.validateAdminAccess = original;
  });
  Classroom.validateAdminAccess = async () => {};

  await Batch.create({
    classroomId: challenge.classroomId,
    challengeId: challenge._id,
    organization,
    processingRunId: challenge.processingRun.id,
    status: "created",
    createdBy: "admin",
    updatedBy: "admin",
  });
  await Challenge.updateOne(
    { _id: challenge._id },
    {
      $unset: { processingRun: 1 },
      $set: { automationStatus: "acceptingSubmissions", isClosed: false },
    },
  );

  const updated = await processing.updateSettings(
    challenge._id,
    organization,
    "admin",
    { simulationMode: "direct", simulationConcurrency: 5 },
  );

  assert.equal(updated.simulationMode, "direct");
  assert.equal(updated.simulationConcurrency, 5);
});

test("run creation is resumable and a completed challenge can switch to batch before rerunning", async (t) => {
  const Decision = require("../decision/decision.model");
  const Completion = require("./ledgerCompletionEvent.model");
  const BatchWorker = require("../../lib/queues/simulation-batch-worker");
  const { challenge, organization } = await fixture(0, 3);
  await Challenge.updateOne(
    { _id: challenge._id },
    {
      $unset: { processingRun: 1 },
      $set: { isClosed: false, automationStatus: "acceptingSubmissions" },
    },
  );
  await Decision.insertMany(
    Array.from({ length: 7 }, () => ({
      challengeId: challenge._id,
      classroomId: challenge.classroomId,
      organization,
      userId: new mongoose.Types.ObjectId(),
      createdBy: "admin",
      updatedBy: "admin",
    })),
  );
  const originalCompletion = Completion.recordChallengeLedgersComplete;
  const originalEnqueue = BatchWorker.enqueueSimulationBatchSubmit;
  const originalAccess = Classroom.validateAdminAccess;
  t.after(() => {
    Completion.recordChallengeLedgersComplete = originalCompletion;
    BatchWorker.enqueueSimulationBatchSubmit = originalEnqueue;
    Classroom.validateAdminAccess = originalAccess;
  });
  Completion.recordChallengeLedgersComplete = async () => ({ ready: false });
  Classroom.validateAdminAccess = async () => {};
  const args = {
    challengeId: challenge._id,
    organizationId: organization,
    clerkUserId: "admin",
  };
  const first = await processing.startChallenge(args);
  assert.equal(first.length, 7);
  assert.equal(await Job.countDocuments({ dispatchReserved: true }), 3);
  const runId = first[0].processingRunId;
  const again = await processing.startChallenge(args);
  assert.equal(again[0].processingRunId, runId);
  assert.equal(await Job.countDocuments(), 7);
  assert.equal(await Job.countDocuments({ dispatchReserved: true }), 3);
  await queues.simulation.pause(true);
  await until(async () => (await queues.simulation.getActive()).length === 0);
  await queues.simulation.empty();
  await Job.updateMany(
    {},
    { $set: { status: "completed", dispatchReserved: false } },
  );
  await Challenge.updateOne(
    { _id: challenge._id },
    { $set: { automationStatus: "processed" } },
  );
  await processing.updateSettings(challenge._id, organization, "admin", {
    simulationMode: "batch",
    simulationConcurrency: 2,
  });
  const submitted = [];
  BatchWorker.enqueueSimulationBatchSubmit = async (payload) => {
    submitted.push(payload);
  };
  const next = await processing.startChallenge({ ...args, rerun: true });
  assert.equal(next.length, 7);
  assert.notEqual(next[0].processingRunId, runId);
  assert.equal(next[0].simulationMode, "batch");
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].processingRunId, next[0].processingRunId);
  assert.equal(await Job.countDocuments({ dispatchReserved: true }), 0);

  const direct = await processing.startChallenge({
    ...args,
    rerun: true,
    cancelBatch: true,
    replacementSettings: { simulationMode: "direct", simulationConcurrency: 2 },
  });
  const changedChallenge = await Challenge.findById(challenge._id);
  assert.equal(changedChallenge.simulationMode, "direct");
  assert.equal(changedChallenge.simulationConcurrency, 2);
  assert.equal(direct[0].simulationMode, "direct");
  assert.equal(await Job.countDocuments({ dispatchReserved: true }), 2);
});

test("run preparation resumes without resetting jobs already prepared for that run", async (t) => {
  const Decision = require("../decision/decision.model");
  const Completion = require("./ledgerCompletionEvent.model");
  const { challenge, jobs, organization } = await fixture(1, 1);
  await Challenge.updateOne(
    { _id: challenge._id },
    { $set: { "processingRun.preparing": true } },
  );
  await Decision.create({
    challengeId: challenge._id,
    classroomId: challenge.classroomId,
    organization,
    userId: jobs[0].userId,
    createdBy: "admin",
    updatedBy: "admin",
  });
  await Job.updateOne({ _id: jobs[0]._id }, { $set: { attempts: 2 } });
  const original = Completion.recordChallengeLedgersComplete;
  t.after(() => {
    Completion.recordChallengeLedgersComplete = original;
  });
  Completion.recordChallengeLedgersComplete = async () => ({ ready: false });
  const result = await processing.startChallenge({
    challengeId: challenge._id,
    organizationId: organization,
    clerkUserId: "admin",
  });
  assert.equal(String(result[0]._id), String(jobs[0]._id));
  assert.equal(result[0].attempts, 2);
  assert.equal(
    (await Challenge.findById(challenge._id)).processingRun.preparing,
    false,
  );
  assert.equal(await Job.countDocuments({ dispatchReserved: true }), 1);
  await queues.simulation.pause(true);
  await until(async () => (await queues.simulation.getActive()).length === 0);
  await queues.simulation.empty();
  await Job.updateMany({}, { $set: { dispatchReserved: false } });
});

test("a superseded Bull job cannot calculate or overwrite the replacement run", async () => {
  const { jobs } = await fixture(1, 1);
  let called = false;
  processImplementation = async () => {
    called = true;
  };
  const result =
    await require("../../lib/queues/simulation-worker").processSimulationJob({
      data: { jobId: jobs[0]._id, processingRunId: "old-run" },
      opts: { attempts: 3 },
      attemptsMade: 0,
    });
  assert.equal(result.skipped, true);
  assert.equal(called, false);
});

test("cancelled and superseded batch polls never retrieve or ingest provider output", async (t) => {
  const Batch = require("./simulationBatch.model");
  const openai = require("../../lib/openai");
  const { challenge, organization } = await fixture(0, 1);
  let retrieved = 0;
  t.mock.method(openai.batches, "retrieve", async () => {
    retrieved += 1;
    throw new Error("must not retrieve stale output");
  });
  const cancelled = await Batch.create({
    challengeId: challenge._id,
    classroomId: challenge.classroomId,
    organization,
    processingRunId: challenge.processingRun.id,
    openaiBatchId: "cancelled-provider-batch",
    status: "cancelled",
    jobCount: 1,
    createdBy: "admin",
    updatedBy: "admin",
  });
  const worker = require("../../lib/queues/simulation-batch-worker");
  const cancelledResult = await worker.processPoll({
    data: {
      simulationBatchId: cancelled._id,
      openaiBatchId: cancelled.openaiBatchId,
    },
  });
  assert.equal(cancelledResult.reason, "Batch cancelled");
  const stale = await Batch.create({
    challengeId: challenge._id,
    classroomId: challenge.classroomId,
    organization,
    processingRunId: "previous-run",
    openaiBatchId: "stale-provider-batch",
    status: "submitted",
    jobCount: 1,
    createdBy: "admin",
    updatedBy: "admin",
  });
  const staleResult = await worker.processPoll({
    data: { simulationBatchId: stale._id, openaiBatchId: stale.openaiBatchId },
  });
  assert.equal(staleResult.reason, "Superseded calculation run");
  assert.equal(retrieved, 0);
});
