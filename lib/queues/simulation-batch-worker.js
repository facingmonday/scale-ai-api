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
const Submission = require("../../services/submission/submission.model");

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

function computeStoreVariablesSnapshot(store) {
  const storeMetadataKeys = [
    "studentId",
    "shopName",
    "storeType",
    "storeTypeId",
    "storeTypeLabel",
    "storeTypeDescription",
    "storeDescription",
    "storeLocation",
    "startingBalance",
    "currentDetails",
    "variablesDetailed",
  ];
  const storeVariables = {};
  if (store && typeof store === "object") {
    Object.keys(store).forEach((key) => {
      if (!storeMetadataKeys.includes(key)) {
        storeVariables[key] = store[key];
      }
    });
  }
  return storeVariables;
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

  // Build OpenAI request (use cached basePrompts to reduce DB reads)
  const { rawMessages, request } =
    await LedgerEntry.buildAISimulationOpenAIRequest(context, basePrompts);

  const storeVariables = computeStoreVariablesSnapshot(context.store);
  const scenarioVariables =
    context.scenario?.variables &&
    typeof context.scenario.variables === "object"
      ? context.scenario.variables
      : {};
  const submissionVariables =
    context.submission?.variables &&
    typeof context.submission.variables === "object"
      ? context.submission.variables
      : {};
  const outcomeVariables =
    context.scenarioOutcome?.variables &&
    typeof context.scenarioOutcome.variables === "object"
      ? context.scenarioOutcome.variables
      : {};

  // Carry outcome knobs used elsewhere
  if (context.scenarioOutcome) {
    if (context.scenarioOutcome.randomEventChancePercent !== undefined) {
      outcomeVariables.randomEventChancePercent =
        context.scenarioOutcome.randomEventChancePercent;
    }
    if (context.scenarioOutcome.notes) {
      outcomeVariables.notes = context.scenarioOutcome.notes;
    }
  }

  const storeId = context.store?.storeId || null;

  const calculationContextSnapshot = {
    storeId,
    storeVariables,
    scenarioVariables,
    submissionVariables,
    outcomeVariables,
    priorState: {
      cashBefore: context.cashBefore,
      inventoryState: context.inventoryState || {
        refrigeratedUnits: 0,
        ambientUnits: 0,
        notForResaleUnits: 0,
      },
    },
  };

  jobDoc.openaiRequest = request;
  jobDoc.openaiRequestRawMessages = rawMessages;
  jobDoc.openaiRequestPreparedAt = new Date();
  jobDoc.expectedCashBefore = context.cashBefore;
  jobDoc.expectedInventoryState = {
    refrigeratedUnits: context.inventoryState?.refrigeratedUnits ?? 0,
    ambientUnits: context.inventoryState?.ambientUnits ?? 0,
    notForResaleUnits: context.inventoryState?.notForResaleUnits ?? 0,
  };
  jobDoc.calculationContextSnapshot = calculationContextSnapshot;
  await jobDoc.save();

  return jobDoc;
}

function applyCashBeforeCorrection(aiResult, expectedCashBefore) {
  const round2 = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return n;
    return Math.round((x + Number.EPSILON) * 100) / 100;
  };

  if (
    typeof expectedCashBefore === "number" &&
    Number.isFinite(expectedCashBefore) &&
    Math.abs(aiResult.cashBefore - expectedCashBefore) > 0.01
  ) {
    console.warn(
      `AI cashBefore (${aiResult.cashBefore}) doesn't match expected (${expectedCashBefore}). Correcting...`
    );
    const adjustment = expectedCashBefore - aiResult.cashBefore;
    aiResult.cashBefore = expectedCashBefore;
    aiResult.cashAfter = aiResult.cashAfter + adjustment;
  }

  // Recalculate netProfit after any adjustment to preserve continuity
  const expectedNetProfit = aiResult.cashAfter - aiResult.cashBefore;
  if (Math.abs(aiResult.netProfit - expectedNetProfit) > 0.01) {
    console.warn(
      `AI netProfit (${aiResult.netProfit}) doesn't match cashAfter - cashBefore (${expectedNetProfit}). Correcting...`
    );
    aiResult.netProfit = expectedNetProfit;
  }

  // Stabilize currency formatting (cents) to prevent float drift in persisted ledger values
  aiResult.cashBefore = round2(aiResult.cashBefore);
  aiResult.cashAfter = round2(aiResult.cashAfter);
  aiResult.netProfit = round2(aiResult.cashAfter - aiResult.cashBefore);
  aiResult.cashAfter = round2(aiResult.cashBefore + aiResult.netProfit);
}

async function writeLedgerEntryFromSnapshot(jobDoc, aiResult) {
  const snapshot = jobDoc.calculationContextSnapshot || {};
  const organizationId = jobDoc.organization;

  const calculationContext = {
    storeVariables: snapshot.storeVariables || {},
    scenarioVariables: snapshot.scenarioVariables || {},
    submissionVariables: snapshot.submissionVariables || {},
    outcomeVariables: snapshot.outcomeVariables || {},
    priorState: snapshot.priorState || {},
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
    storeId: snapshot.storeId || null,
    classroomId: jobDoc.classroomId,
    scenarioId: jobDoc.scenarioId,
    submissionId: jobDoc.submissionId || null,
    userId: jobDoc.userId,
    sales: aiResult.sales,
    revenue: aiResult.revenue,
    costs: aiResult.costs,
    waste: aiResult.waste,
    cashBefore: aiResult.cashBefore,
    cashAfter: aiResult.cashAfter,
    inventoryState: aiResult.inventoryState || {
      refrigeratedUnits: 0,
      ambientUnits: 0,
      notForResaleUnits: 0,
    },
    netProfit: aiResult.netProfit,
    randomEvent: aiResult.randomEvent,
    summary: aiResult.summary,
    education: aiResult.education,
    aiMetadata,
    calculationContext,
  };

  const entry = await LedgerEntry.createLedgerEntry(
    ledgerInput,
    organizationId,
    jobDoc.createdBy
  );

  // Attach ledger entry to submission (mirrors SimulationWorker.writeLedgerEntry)
  try {
    if (jobDoc.submissionId) {
      await Submission.updateOne(
        { _id: jobDoc.submissionId },
        { $set: { ledgerEntryId: entry._id } }
      );
    } else {
      await Submission.updateOne(
        {
          classroomId: jobDoc.classroomId,
          scenarioId: jobDoc.scenarioId,
          userId: jobDoc.userId,
        },
        { $set: { ledgerEntryId: entry._id } }
      );
    }
  } catch (err) {
    console.error("Failed to attach ledger entry to submission:", err);
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
  const { scenarioId, classroomId, organizationId, clerkUserId } =
    job.data || {};
  if (!scenarioId || !classroomId || !organizationId || !clerkUserId) {
    throw new Error(
      "Missing required fields in submit payload (scenarioId, classroomId, organizationId, clerkUserId)"
    );
  }

  await ensureDbConnected();

  const pendingJobs = await SimulationJob.find({
    scenarioId,
    classroomId,
    organization: organizationId,
    status: "pending",
  }).sort({ createdDate: 1 });

  if (pendingJobs.length === 0) {
    return { success: true, message: "No pending jobs to submit", count: 0 };
  }

  const batch = await SimulationBatch.createBatch(
    { scenarioId, classroomId, jobCount: pendingJobs.length },
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
      scenarioId: String(scenarioId),
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

    let successCount = 0;
    let failCount = 0;

    for (const it of items) {
      const customId = String(it.custom_id || "");
      const jobDoc = jobsById.get(customId);
      if (!jobDoc) {
        console.warn(
          `No SimulationJob found for custom_id=${customId}, skipping`
        );
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
        // Normalize + validate (same behavior as direct path)
        LedgerEntry.normalizeAndValidateAISimulationResult(aiResult);
        applyCashBeforeCorrection(aiResult, jobDoc.expectedCashBefore);

        if (!jobDoc.dryRun) {
          await writeLedgerEntryFromSnapshot(jobDoc, aiResult);
        }

        await jobDoc.markCompleted();
        await SimulationWorker.updateSubmissionStatus(
          jobDoc,
          "completed"
        ).catch(() => {});
        successCount += 1;
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

    return { success: true, status: "completed", successCount, failCount };
  }

  if (status === "failed" || status === "expired" || status === "cancelled") {
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
  scenarioId,
  classroomId,
  organizationId,
  clerkUserId,
}) => {
  await ensureQueueReady(queues.simulationBatch, "simulationBatch");
  return queues.simulationBatch.add(
    "submit",
    { scenarioId, classroomId, organizationId, clerkUserId },
    { removeOnComplete: true, removeOnFail: false, attempts: 3 }
  );
};

module.exports = {
  initSimulationBatchWorker,
  enqueueSimulationBatchSubmit,
};
