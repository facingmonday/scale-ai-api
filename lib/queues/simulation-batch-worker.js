const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const openai = require("../openai");
const { queues, ensureQueueReady } = require("./index");

const SimulationJob = require("../../services/job/job.model");
const SimulationBatch = require("../../services/job/simulationBatch.model");
const SimulationWorker = require("../../services/job/lib/simulationWorker");
const LedgerEntry = require("../../services/ledger/ledger.model");
const Decision = require("../../services/decision/decision.model");
const VariableDefinition = require("../../services/variableDefinition/variableDefinition.model");
const MetricDefinition = require("../../services/metricDefinition/metricDefinition.model");

const DEFAULT_POLL_SECONDS = Number(process.env.SIM_BATCH_POLL_SECONDS || 120);
const FINALIZING_POLL_SECONDS = Number(
  process.env.SIM_BATCH_POLL_FINALIZING_SECONDS || 60
);
const MAX_POLL_SECONDS = Number(process.env.SIM_BATCH_POLL_MAX_SECONDS || 600);

const jitterMs = (baseMs) => {
  const jitter = Math.floor(Math.random() * 15000); // up to 15s
  return Math.max(0, baseMs + jitter);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const safeJsonParseLine = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};

const parseJsonl = (text) =>
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(safeJsonParseLine)
    .filter(Boolean);

function computeProfileVariablesSnapshot(profile) {
  const profileMetadataKeys = [
    "studentId",
    "shopName",
    "profileType",
    "profileTypeId",
    "profileTypeLabel",
    "profileTypeDescription",
    "profileDescription",
    "profileLocation",
    "profileId",
    "profileId",
    "profileType",
    "storeTypeId",
    "storeTypeLabel",
    "storeTypeDescription",
    "storeDescription",
    "storeLocation",
    "startingBalance",
    "currentDetails",
    "variablesDetailed",
  ];
  const profileVariables = {};
  if (profile && typeof profile === "object") {
    Object.keys(profile).forEach((key) => {
      if (!profileMetadataKeys.includes(key)) {
        profileVariables[key] = profile[key];
      }
    });
  }
  return profileVariables;
}

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return;
  // Retry briefly to avoid transient startup races
  for (let i = 0; i < 3; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URL || process.env.MONGO_URI);
      return;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(500);
    }
  }
}

async function buildAndPersistJobPayload(jobDoc, basePrompts) {
  const context = await SimulationWorker.fetchJobContext(jobDoc);

  const { rawMessages, request } =
    await LedgerEntry.buildAISimulationOpenAIRequest(context, basePrompts);

  const profileVariables = computeProfileVariablesSnapshot(context.profile);
  const challengeVariables =
    context.challenge?.variables &&
    typeof context.challenge.variables === "object"
      ? context.challenge.variables
      : {};
  const decisionVariables =
    context.decision?.variables &&
    typeof context.decision.variables === "object"
      ? context.decision.variables
      : {};
  const outcomeVariables =
    context.outcome?.variables && typeof context.outcome.variables === "object"
      ? { ...context.outcome.variables }
      : {};

  const classroomId =
    context.challenge?.classroomId ||
    context.decision?.classroomId ||
    context.outcome?.classroomId ||
    null;
  const filtered = classroomId
    ? await VariableDefinition.filterVariablesForAIContext(classroomId, {
        profileVariables,
        challengeVariables,
        decisionVariables,
        outcomeVariables,
      })
    : {
        profileVariables,
        challengeVariables,
        decisionVariables,
        outcomeVariables,
      };

  const profileId = context.profile?.profileId || context.profile?.profileId || null;

  const calculationContextSnapshot = {
    profileId,
    profileVariables: filtered.profileVariables,
    challengeVariables: filtered.challengeVariables,
    decisionVariables: filtered.decisionVariables,
    outcomeVariables: filtered.outcomeVariables,
    priorMetrics: context.priorMetrics || {},
  };

  jobDoc.openaiRequest = request;
  jobDoc.openaiRequestRawMessages = rawMessages;
  jobDoc.openaiRequestPreparedAt = new Date();
  jobDoc.calculationContextSnapshot = calculationContextSnapshot;
  await jobDoc.save();

  return jobDoc;
}

async function writeLedgerEntryFromSnapshot(jobDoc, aiResult) {
  const snapshot = jobDoc.calculationContextSnapshot || {};
  const organizationId = jobDoc.organization;

  const metricDefs = await MetricDefinition.getActive(jobDoc.classroomId);
  const metrics = LedgerEntry.extractMetricsFromAIResult(aiResult, metricDefs);

  const calculationContext = {
    profileVariables: snapshot.profileVariables || {},
    challengeVariables: snapshot.challengeVariables || {},
    decisionVariables: snapshot.decisionVariables || {},
    outcomeVariables: snapshot.outcomeVariables || {},
    priorMetrics: snapshot.priorMetrics || {},
    ledgerHistorySummary: [],
    prompt: jobDoc.openaiRequestRawMessages
      ? JSON.stringify(jobDoc.openaiRequestRawMessages, null, 2)
      : null,
  };

  const aiModel = jobDoc.openaiRequest?.model || process.env.AI_MODEL;
  const aiMetadata = {
    model: aiModel,
    runId: uuidv4(),
    generatedAt: new Date(),
  };

  const ledgerInput = {
    profileId: snapshot.profileId || null,
    classroomId: jobDoc.classroomId,
    challengeId: jobDoc.challengeId,
    decisionId: jobDoc.decisionId || null,
    userId: jobDoc.userId,
    metrics,
    randomEvent: aiResult.randomEvent,
    summary: aiResult.summary,
    aiMetadata,
    calculationContext,
  };

  const entry = await LedgerEntry.createLedgerEntry(
    ledgerInput,
    organizationId,
    jobDoc.createdBy
  );

  try {
    if (jobDoc.decisionId) {
      await Decision.updateOne(
        { _id: jobDoc.decisionId },
        { $set: { ledgerEntryId: entry._id } }
      );
    } else {
      await Decision.updateOne(
        {
          classroomId: jobDoc.classroomId,
          challengeId: jobDoc.challengeId,
          userId: jobDoc.userId,
        },
        { $set: { ledgerEntryId: entry._id } }
      );
    }
  } catch (err) {
    console.error("Failed to attach ledger entry to decision:", err);
  }

  jobDoc.ledgerEntryId = entry._id;
  await jobDoc.save();

  return entry;
}

async function downloadOpenAIFileText(fileId) {
  const res = await openai.files.content(fileId);
  // OpenAI SDK returns a fetch Response-like object
  return await res.text();
}

async function processSubmit(job) {
  const { challengeId, classroomId, organizationId, clerkUserId } =
    job.data || {};
  if (!challengeId || !classroomId || !organizationId || !clerkUserId) {
    throw new Error(
      "Missing required fields in submit payload (challengeId, classroomId, organizationId, clerkUserId)"
    );
  }

  await ensureDbConnected();

  const pendingJobs = await SimulationJob.find({
    challengeId,
    classroomId,
    organization: organizationId,
    status: "pending",
  }).sort({ createdDate: 1 });

  if (pendingJobs.length === 0) {
    return { success: true, message: "No pending jobs to submit", count: 0 };
  }

  const batch = await SimulationBatch.createBatch(
    { challengeId, classroomId, jobCount: pendingJobs.length },
    organizationId,
    clerkUserId
  );

  const basePrompts = await LedgerEntry.getClassroomBasePrompts(classroomId);

  // Prepare each job payload (sequential to keep load predictable)
  for (const j of pendingJobs) {
    await buildAndPersistJobPayload(j, basePrompts);
  }

  // Create JSONL file for OpenAI Batch
  const lines = pendingJobs.map((j) =>
    JSON.stringify({
      custom_id: String(j._id),
      method: "POST",
      url: "/v1/chat/completions",
      body: j.openaiRequest,
    })
  );

  const tmpPath = path.join(os.tmpdir(), `scale-sim-batch-${batch._id}.jsonl`);
  fs.writeFileSync(tmpPath, lines.join("\n") + "\n", "utf8");

  const file = await openai.files.create({
    file: fs.createReadStream(tmpPath),
    purpose: "batch",
  });

  const openaiBatch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: "/v1/chat/completions",
    completion_window: "24h",
    metadata: {
      challengeId: String(challengeId),
      classroomId: String(classroomId),
      organizationId: String(organizationId),
      simulationBatchId: String(batch._id),
    },
  });

  await batch.markSubmitted({
    openaiBatchId: openaiBatch.id,
    inputFileId: file.id,
    submittedAt: new Date(),
  });

  const now = new Date();
  await SimulationJob.updateMany(
    { _id: { $in: pendingJobs.map((j) => j._id) } },
    {
      $set: {
        status: "running",
        startedAt: now,
        "batch.openaiBatchId": openaiBatch.id,
        "batch.inputFileId": file.id,
        "batch.submittedAt": now,
      },
      $inc: { attempts: 1 },
    }
  );

  // Enqueue first poll ~60s after submit
  const firstDelayMs = jitterMs(60 * 1000);
  await ensureQueueReady(queues.simulationBatch, "simulationBatch");
  await queues.simulationBatch.add(
    "poll",
    { simulationBatchId: batch._id, openaiBatchId: openaiBatch.id },
    {
      delay: firstDelayMs,
      attempts: 10,
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  return {
    success: true,
    simulationBatchId: batch._id,
    openaiBatchId: openaiBatch.id,
    jobCount: pendingJobs.length,
  };
}

async function processPoll(job) {
  const { simulationBatchId, openaiBatchId } = job.data || {};
  if (!simulationBatchId || !openaiBatchId) {
    throw new Error("Missing simulationBatchId/openaiBatchId in poll payload");
  }

  await ensureDbConnected();

  const batch = await SimulationBatch.findById(simulationBatchId);
  if (!batch) {
    throw new Error(`SimulationBatch not found: ${simulationBatchId}`);
  }

  const openaiBatch = await openai.batches.retrieve(openaiBatchId);
  await batch.updateFromOpenAIStatus(openaiBatch);

  const status = openaiBatch.status;
  if (status === "completed") {
    const outputFileId = openaiBatch.output_file_id;
    if (!outputFileId) {
      throw new Error(
        `Batch completed but no output_file_id present: ${openaiBatchId}`
      );
    }

    const outputText = await downloadOpenAIFileText(outputFileId);
    const items = parseJsonl(outputText);

    // Map jobs by custom_id
    const jobIds = items
      .map((it) => it.custom_id)
      .filter(Boolean)
      .map((id) => String(id));

    const jobs = await SimulationJob.find({
      _id: { $in: jobIds },
      "batch.openaiBatchId": openaiBatchId,
    });
    const jobsById = new Map(jobs.map((j) => [String(j._id), j]));
    const LedgerCompletionEvent = require("../../services/job/ledgerCompletionEvent.model");

    let successCount = 0;
    let failCount = 0;
    const lifecycleErrors = [];

    for (const it of items) {
      const customId = String(it.custom_id || "");
      const jobDoc = jobsById.get(customId);
      if (!jobDoc) {
        console.warn(
          `No SimulationJob found for custom_id=${customId}, skipping`
        );
        continue;
      }

      // A completed OpenAI batch may be handled more than once after a queue
      // retry. Preserve already-durable terminal outcomes and only reconcile
      // their lifecycle event instead of rewriting ledgers.
      if (jobDoc.status === "completed" || jobDoc.status === "failed") {
        if (jobDoc.status === "completed") {
          successCount += 1;
          try {
            await LedgerCompletionEvent.recordReadyEventsForJob(jobDoc._id);
          } catch (error) {
            lifecycleErrors.push(error);
          }
        } else {
          failCount += 1;
        }
        continue;
      }

      try {
        const statusCode = it.response?.status_code;
        if (!statusCode || statusCode < 200 || statusCode >= 300) {
          const errMsg =
            it.error?.message ||
            it.response?.body?.error?.message ||
            `OpenAI batch item failed with status_code=${statusCode || "unknown"}`;
          await jobDoc.markFailed(errMsg);
          await SimulationWorker.updateSubmissionStatus(jobDoc, "failed").catch(
            () => {}
          );
          failCount += 1;
          continue;
        }

        const content = it.response?.body?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error(
            "Missing choices[0].message.content in batch item response"
          );
        }

        const aiResult = JSON.parse(content);
        const debugContext = {
          simulationMode: "batch",
          jobId: String(jobDoc._id),
          classroomId: String(jobDoc.classroomId),
          challengeId: String(jobDoc.challengeId),
          decisionId: jobDoc.decisionId ? String(jobDoc.decisionId) : null,
        };
        if (LedgerEntry.shouldInspectOpenAIRequest(debugContext)) {
          LedgerEntry.inspectOpenAIResponse(it.response?.body, debugContext);
        }
        await LedgerEntry.normalizeAndValidateAISimulationResult(
          aiResult,
          jobDoc.classroomId
        );

        if (!jobDoc.dryRun) {
          await writeLedgerEntryFromSnapshot(jobDoc, aiResult);
        }

        await jobDoc.markCompleted();
        await SimulationWorker.updateSubmissionStatus(
          jobDoc,
          "completed"
        ).catch(() => {});
        successCount += 1;
        try {
          await LedgerCompletionEvent.recordReadyEventsForJob(jobDoc._id);
        } catch (error) {
          lifecycleErrors.push(error);
        }
      } catch (e) {
        await jobDoc.markFailed(e.message || String(e));
        await SimulationWorker.updateSubmissionStatus(jobDoc, "failed").catch(
          () => {}
        );
        failCount += 1;
      }
    }

    // High-signal log for batch completion (the Bull "completed" event only logs job name/id)
    console.log(
      `✅ OpenAI batch completed: simulationBatchId=${simulationBatchId} openaiBatchId=${openaiBatchId} ` +
        `(success=${successCount}, failed=${failCount}, total=${successCount + failCount})`
    );

    const completion = await LedgerCompletionEvent.recordChallengeLedgersComplete(
      batch.challengeId,
    );
    if (!completion.ready) {
      throw new Error(
        `Challenge ledger completion is not ready: ${completion.reason}`,
      );
    }
    if (lifecycleErrors.length > 0) {
      throw new Error(
        `Failed to persist or enqueue ${lifecycleErrors.length} student ledger completion event(s): ${lifecycleErrors
          .map((error) => error.message)
          .join("; ")}`,
      );
    }

    return {
      success: true,
      status: "completed",
      successCount,
      failCount,
      ledgerCompletionEventId: completion.event?._id,
    };
  }

  // Treat cancelling as terminal - stop polling; batch is being shut down
  if (
    status === "failed" ||
    status === "expired" ||
    status === "cancelled" ||
    status === "cancelling"
  ) {
    await batch.markFailed(`OpenAI batch ended with status: ${status}`);
    return { success: false, status };
  }

  // Re-enqueue poll with appropriate delay
  const baseSeconds =
    status === "finalizing" ? FINALIZING_POLL_SECONDS : DEFAULT_POLL_SECONDS;
  const nextDelayMs = jitterMs(Math.min(MAX_POLL_SECONDS, baseSeconds) * 1000);

  await ensureQueueReady(queues.simulationBatch, "simulationBatch");
  await queues.simulationBatch.add(
    "poll",
    { simulationBatchId: batch._id, openaiBatchId },
    {
      delay: nextDelayMs,
      attempts: 20,
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  return { success: true, status, nextPollMs: nextDelayMs };
}

const initSimulationBatchWorker = () => {
  console.log("📦 Initializing simulation batch worker...");

  const parsedConcurrency = parseInt(
    process.env.SIMULATION_BATCH_CONCURRENCY || "1",
    10
  );
  const concurrency = Number.isFinite(parsedConcurrency)
    ? Math.max(1, parsedConcurrency)
    : 1;

  queues.simulationBatch.process("submit", concurrency, processSubmit);
  queues.simulationBatch.process("poll", concurrency, processPoll);

  // Bull emits: (job, result). Log result for visibility (counts, nextPollMs, etc.)
  queues.simulationBatch.on("completed", (job, result) => {
    const base = `✅ SimulationBatch job completed: ${job.name} (${job.id})`;
    if (result && typeof result === "object") {
      console.log(base, result);
    } else if (result !== undefined) {
      console.log(base, { result });
    } else {
      console.log(base);
    }
  });

  queues.simulationBatch.on("failed", (job, err) => {
    const id = job?.id || "unknown";
    console.error(
      `❌ SimulationBatch job failed: ${job?.name || "unknown"} (${id}) - ${err.message}`
    );
  });

  console.log(
    `✅ Simulation batch worker initialized (concurrency: ${concurrency})`
  );
};

const enqueueSimulationBatchSubmit = async ({
  challengeId,
  classroomId,
  organizationId,
  clerkUserId,
}) => {
  await ensureQueueReady(queues.simulationBatch, "simulationBatch");
  return queues.simulationBatch.add(
    "submit",
    { challengeId, classroomId, organizationId, clerkUserId },
    { removeOnComplete: true, removeOnFail: false, attempts: 3 }
  );
};

module.exports = {
  initSimulationBatchWorker,
  enqueueSimulationBatchSubmit,
};
