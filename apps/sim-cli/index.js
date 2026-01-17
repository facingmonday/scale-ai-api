#!/usr/bin/env node

/**
 * Simulation CLI (dev tool)
 *
 * IMPORTANT: This is intentionally implemented as a standalone tool under `apps/`
 * to avoid impacting any production runtime code paths.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const { createInterface } = require("readline");
const { randomUUID } = require("crypto");

// Load all mongoose models
require("../../models");

const Organization = require("../../services/organizations/organization.model");
const Member = require("../../services/members/member.model");
const Classroom = require("../../services/classroom/classroom.model");
const Enrollment = require("../../services/enrollment/enrollment.model");
const ClassroomTemplate = require("../../services/classroomTemplate/classroomTemplate.model");
const StoreType = require("../../services/storeType/storeType.model");
const Store = require("../../services/store/store.model");
const Scenario = require("../../services/scenario/scenario.model");
const ScenarioOutcome = require("../../services/scenarioOutcome/scenarioOutcome.model");
const LedgerEntry = require("../../services/ledger/ledger.model");
const {
  autoCreateSubmissionsForScenario,
} = require("../../services/submission/autoCreateSubmissionsForScenario");
const {
  useDefaultsForSubmissions,
} = require("../../services/submission/useDefaultsForSubmissions");
const JobService = require("../../services/job/lib/jobService");
const {
  enqueueSimulationBatchSubmit,
} = require("../../lib/queues/simulation-batch-worker");

function toSafeSlugPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeRl() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

function parseArgs(argv) {
  const args = { dryRun: false, nonInteractive: false };
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") args.dryRun = true;
    if (raw === "--non-interactive" || raw === "--yes" || raw === "-y")
      args.nonInteractive = true;
  }
  if (!process.stdin.isTTY) args.nonInteractive = true;
  return args;
}

async function promptLine(rl, question, { defaultValue = null } = {}) {
  if (!rl) {
    return defaultValue !== null ? String(defaultValue) : "";
  }
  const suffix = defaultValue !== null ? ` (default: ${defaultValue})` : "";
  const answer = await new Promise((resolve) => {
    try {
      rl.question(`${question}${suffix}: `, resolve);
    } catch (e) {
      // Non-interactive shells can close stdin; fall back to default.
      return resolve(defaultValue !== null ? String(defaultValue) : "");
    }
  });
  const trimmed = String(answer || "").trim();
  if (!trimmed && defaultValue !== null) return String(defaultValue);
  return trimmed;
}

async function promptYesNo(rl, question, { defaultValue = false } = {}) {
  const defLabel = defaultValue ? "Y/n" : "y/N";
  const answer = await promptLine(rl, `${question} [${defLabel}]`, {
    defaultValue: "",
  });
  const t = String(answer || "")
    .trim()
    .toLowerCase();
  if (!t) return !!defaultValue;
  if (["y", "yes"].includes(t)) return true;
  if (["n", "no"].includes(t)) return false;
  return !!defaultValue;
}

async function promptInt(rl, question, { defaultValue, min, max } = {}) {
  while (true) {
    const raw = await promptLine(rl, question, {
      defaultValue: defaultValue !== undefined ? String(defaultValue) : null,
    });
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      console.log("Please enter a valid integer.");
      continue;
    }
    if (min !== undefined && n < min) {
      console.log(`Must be >= ${min}.`);
      continue;
    }
    if (max !== undefined && n > max) {
      console.log(`Must be <= ${max}.`);
      continue;
    }
    return n;
  }
}

async function promptChoice(rl, question, options, { defaultIndex = 0 } = {}) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error("promptChoice requires at least one option");
  }
  console.log(question);
  options.forEach((opt, idx) => {
    console.log(`  ${idx + 1}) ${opt.label}`);
  });
  const chosen = await promptInt(rl, "Select option", {
    defaultValue: defaultIndex + 1,
    min: 1,
    max: options.length,
  });
  return options[chosen - 1].value;
}

function buildMongoUrlFromParts() {
  const {
    MONGO_SCHEME,
    MONGO_USERNAME,
    MONGO_PASSWORD,
    MONGO_HOSTNAME,
    MONGO_DB,
  } = process.env;
  if (
    !MONGO_SCHEME ||
    !MONGO_USERNAME ||
    !MONGO_PASSWORD ||
    !MONGO_HOSTNAME ||
    !MONGO_DB
  ) {
    return null;
  }
  return `${MONGO_SCHEME}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DB}?authSource=admin`;
}

function getMongoUrlOrThrow() {
  const direct = process.env.MONGO_URL || process.env.MONGO_URI;
  if (direct) return direct;
  const built = buildMongoUrlFromParts();
  if (built) return built;
  throw new Error(
    "MongoDB connection not configured. Set MONGO_URL (or MONGO_URI), or set MONGO_SCHEME/MONGO_USERNAME/MONGO_PASSWORD/MONGO_HOSTNAME/MONGO_DB."
  );
}

async function connectMongo() {
  if (mongoose.connection.readyState === 1) return;
  const url = getMongoUrlOrThrow();
  await mongoose.connect(url);
}

async function findNextSuffixNumber({ model, field, prefix }) {
  const re = new RegExp(`^${prefix}_(\\d+)$`);
  const docs = await model
    .find({ [field]: { $regex: new RegExp(`^${prefix}_\\d+$`) } })
    .select(field)
    .lean();
  let max = 0;
  for (const d of docs) {
    const v = d?.[field];
    if (typeof v !== "string") continue;
    const m = v.match(re);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return max + 1;
}

function toDisplayName(member) {
  const first = member?.firstName || "";
  const last = member?.lastName || "";
  const name = `${first} ${last}`.trim();
  return name || member?.username || member?.clerkUserId || String(member?._id);
}

async function getCurrentAdminMembers() {
  return await Member.find({
    organizationMemberships: { $elemMatch: { role: "org:admin" } },
  })
    .select(
      "_id clerkUserId firstName lastName username organizationMemberships"
    )
    .lean();
}

async function ensureDefaultTemplateAppliedToClassroom({
  classroomId,
  organizationId,
  clerkUserId,
}) {
  // Ensure org has default template copy
  await ClassroomTemplate.copyGlobalToOrganization(organizationId, clerkUserId);

  const template = await ClassroomTemplate.findOne({
    organization: organizationId,
    key: ClassroomTemplate.GLOBAL_DEFAULT_KEY,
    isActive: true,
  });

  if (template) {
    await template.applyToClassroom({
      classroomId,
      organizationId,
      clerkUserId,
    });

    const prompts = template.payload?.prompts;
    if (Array.isArray(prompts) && prompts.length > 0) {
      await Classroom.updateOne(
        { _id: classroomId, organization: organizationId },
        { $set: { prompts, updatedBy: clerkUserId, updatedDate: new Date() } }
      );
    }
  }
}

async function createLocalOnlyStudents({ organizationDoc, count, seedPrefix }) {
  const toCreate = [];
  for (let i = 0; i < count; i++) {
    const clerkUserId = `${seedPrefix}_s${String(i).padStart(3, "0")}`;
    const now = new Date();
    toCreate.push({
      clerkUserId,
      firstName: "Sim",
      lastName: `Student ${i + 1}`,
      username: clerkUserId,
      publicMetadata: {},
      privateMetadata: {},
      unsafeMetadata: {},
      createdAt: now,
      updatedAt: now,
      organizationMemberships: [
        {
          id: `sim_membership_${clerkUserId}`,
          organizationId: organizationDoc._id,
          role: "org:member",
          publicMetadata: { isActive: true },
          organization: {
            id: organizationDoc.clerkOrganizationId,
            name: organizationDoc.name,
            slug: organizationDoc.slug,
            imageUrl: organizationDoc.imageUrl,
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  }

  const ids = toCreate.map((d) => d.clerkUserId);
  const existing = await Member.find({ clerkUserId: { $in: ids } })
    .select("clerkUserId")
    .lean();
  const existingSet = new Set(existing.map((e) => e.clerkUserId));
  const missing = toCreate.filter((d) => !existingSet.has(d.clerkUserId));
  if (missing.length > 0) {
    await Member.insertMany(missing, { ordered: false });
  }

  return await Member.find({ clerkUserId: { $in: ids } })
    .select("_id clerkUserId")
    .lean();
}

async function main() {
  const args = parseArgs(process.argv);
  const rl = args.nonInteractive ? null : makeRl();

  try {
    await connectMongo();

    const admins = await getCurrentAdminMembers();
    if (!admins.length) {
      throw new Error(
        "No current org admins found in local DB (Member.organizationMemberships.role === 'org:admin'). Create at least one admin user first."
      );
    }

    const actingAdmin = args.nonInteractive
      ? admins[0]
      : await promptChoice(
          rl,
          "Pick the admin user who will OWN the classroom and be used as createdBy/updatedBy:",
          admins.map((a) => ({
            label: `${toDisplayName(a)} (${a.clerkUserId})`,
            value: a,
          })),
          { defaultIndex: 0 }
        );

    // Pick an existing organization from the selected admin's org:admin memberships.
    const actingAdminMemberships = Array.isArray(
      actingAdmin.organizationMemberships
    )
      ? actingAdmin.organizationMemberships
      : [];
    const adminOrgIds = Array.from(
      new Set(
        actingAdminMemberships
          .filter((m) => m && m.role === "org:admin" && m.organizationId)
          .map((m) => String(m.organizationId))
      )
    );

    if (adminOrgIds.length === 0) {
      throw new Error(
        "Selected admin has no org:admin organizationMemberships with organizationId"
      );
    }

    const orgDocs = await Organization.find({ _id: { $in: adminOrgIds } })
      .select("_id name slug clerkOrganizationId imageUrl")
      .lean();

    if (!orgDocs || orgDocs.length === 0) {
      throw new Error(
        "Could not resolve any Organization documents for the selected admin's org:admin memberships"
      );
    }

    const organizationDoc = args.nonInteractive
      ? orgDocs[0]
      : await promptChoice(
          rl,
          "Pick which organization to use for this simulation:",
          orgDocs.map((o) => ({
            label: `${o.name} (${o._id})`,
            value: o,
          })),
          { defaultIndex: 0 }
        );

    const studentCount = args.nonInteractive
      ? 10
      : await promptInt(rl, "How many students?", {
          defaultValue: 10,
          min: 1,
          max: 500,
        });

    const scenarioTitle = await promptLine(rl, "Scenario title", {
      defaultValue: "Week 1: Demand Shock & Supply Constraints",
    });
    const scenarioDescription = await promptLine(rl, "Scenario description", {
      defaultValue: "A sudden demand spike ...",
    });

    const outcomeNotes = await promptLine(
      rl,
      "Scenario outcome notes (shown to students)",
      {
        defaultValue: "The week ended with ...",
      }
    );

    const randomEventChancePercent = args.nonInteractive
      ? 0
      : await promptInt(rl, "Random event chance percent (0-100)", {
          defaultValue: 0,
          min: 0,
          max: 100,
        });

    const simulationMode = String(process.env.SIMULATION_MODE || "direct");
    const useBatch = simulationMode === "batch";

    console.log("\nPlanned actions:");
    console.log(`- dryRun: ${args.dryRun ? "YES" : "no"}`);
    console.log(
      `- org: existing (${organizationDoc.name}) (${useBatch ? "batch ledger mode" : "direct ledger mode"})`
    );
    console.log(`- classroom: auto (template applied)`);
    console.log(`- students: ${studentCount} (local-only mocked clerkUserId)`);
    console.log(`- scenario: "${scenarioTitle}" (published)`);
    console.log(
      `- submissions: AI (if OPENAI_API_KEY set; else optional defaults)`
    );
    console.log(
      `- outcome: randomEventChancePercent=${randomEventChancePercent}`
    );
    console.log(
      `- trigger: ${useBatch ? "enqueue simulation-batch submit job" : "enqueue direct simulation jobs"}`
    );

    const proceed = args.nonInteractive
      ? true
      : await promptYesNo(rl, "Proceed?", { defaultValue: true });
    if (!proceed) {
      console.log("Aborted.");
      process.exit(0);
    }

    if (args.dryRun) {
      console.log("Dry run selected — no data will be written.");
      process.exit(0);
    }

    // 1) Create classroom under selected organization
    const classroomSuffix = await findNextSuffixNumber({
      model: Classroom,
      field: "name",
      prefix: "classroom",
    });
    const classroomName = `classroom_${classroomSuffix}`;

    const classroom = await Classroom.create({
      name: classroomName,
      description: `Simulation CLI created on ${new Date().toISOString()}`,
      isActive: true,
      ownership: actingAdmin._id,
      organization: organizationDoc._id,
      createdBy: actingAdmin.clerkUserId,
      updatedBy: actingAdmin.clerkUserId,
    });

    await Enrollment.enrollUser(
      classroom._id,
      actingAdmin._id,
      "admin",
      organizationDoc._id,
      actingAdmin.clerkUserId
    );

    await ensureDefaultTemplateAppliedToClassroom({
      classroomId: classroom._id,
      organizationId: organizationDoc._id,
      clerkUserId: actingAdmin.clerkUserId,
    });

    // 2) Create students + enroll + stores
    const seedPrefix = `sim_${toSafeSlugPart(organizationDoc.name) || "org"}_${randomUUID().slice(0, 8)}`;

    const students = await createLocalOnlyStudents({
      organizationDoc,
      count: studentCount,
      seedPrefix,
    });

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      await Enrollment.enrollUser(
        classroom._id,
        s._id,
        "member",
        organizationDoc._id,
        actingAdmin.clerkUserId
      );
    }

    const storeTypes = await StoreType.getStoreTypesByClassroom(
      classroom._id,
      organizationDoc._id
    );
    if (!storeTypes.length) {
      throw new Error(
        "No StoreTypes exist for this classroom after template apply. Check ClassroomTemplate payload or template apply."
      );
    }

    const storeTypeCounts = new Map(); // storeTypeId -> count
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const st = storeTypes[i % storeTypes.length];
      storeTypeCounts.set(
        st._id.toString(),
        (storeTypeCounts.get(st._id.toString()) || 0) + 1
      );
      const createdStore = await Store.createStore(
        classroom._id,
        s._id,
        {
          shopName: `Sim Pizza ${toSafeSlugPart(organizationDoc.name) || "org"}-${i + 1}`,
          storeDescription: "Auto-created by simulation CLI.",
          storeLocation: "Sim City",
          studentId: `student_${String(i + 1).padStart(3, "0")}`,
          storeType: st._id,
          variables: {},
        },
        organizationDoc._id,
        actingAdmin.clerkUserId
      );

      // Safety check: ensure the "week 0" initial ledger entry exists.
      // Store.createStore() *should* seed it when creating a brand new store, but if something
      // ever bypasses that path, the simulation will fall back to startingBalance and can drift.
      const hasInitial = await LedgerEntry.findOne({
        classroomId: classroom._id,
        userId: s._id,
        scenarioId: null,
      })
        .select("_id")
        .lean();

      if (!hasInitial) {
        const storeId = createdStore?._id || createdStore?.id;
        const storeTypeDoc = await StoreType.findById(st._id);
        if (storeTypeDoc && storeTypeDoc._loadVariables) {
          await storeTypeDoc._loadVariables();
        }
        if (storeId && storeTypeDoc) {
          await Store.seedInitialLedgerEntry(
            storeId,
            classroom._id,
            s._id,
            storeTypeDoc,
            organizationDoc._id,
            actingAdmin.clerkUserId
          );
        }
      }
    }
    console.log("\nStoreType distribution (round-robin):");
    for (const st of storeTypes) {
      const c = storeTypeCounts.get(st._id.toString()) || 0;
      if (c > 0) console.log(`- ${st.label || st.key || st._id}: ${c}`);
    }

    // 3) Create + publish scenario
    const scenarioObj = await Scenario.createScenario(
      classroom._id,
      { title: scenarioTitle, description: scenarioDescription, variables: {} },
      organizationDoc._id,
      actingAdmin.clerkUserId
    );
    const scenarioId = scenarioObj?._id || scenarioObj?.id;
    // IMPORTANT: Do NOT call scenarioDoc.publish() here.
    // Scenario.publish() triggers a post-save hook that creates "scenario-created" notifications,
    // and notification delivery attempts to resolve student email via Clerk (our simulated students
    // have mocked clerkUserId and do not exist in Clerk).
    // We instead "publish" via an update operation that does not run save hooks.
    await Scenario.updateOne(
      { _id: scenarioId, organization: organizationDoc._id },
      {
        $set: {
          isPublished: true,
          updatedBy: actingAdmin.clerkUserId,
          updatedDate: new Date(),
        },
      }
    );
    const scenarioDoc = await Scenario.findById(scenarioId);

    // 4) Create submissions (AI first, fallback to defaults)
    const subGen = await autoCreateSubmissionsForScenario({
      scenarioId: scenarioDoc._id,
      organizationId: organizationDoc._id,
      clerkUserId: actingAdmin.clerkUserId,
      options: { includeExisting: true },
    });

    if (subGen?.skipped) {
      console.log(`Submissions AI generation skipped: ${subGen.reason}`);
      const useDefaults = await promptYesNo(
        rl,
        "Generate submissions with defaults instead?",
        { defaultValue: true }
      );
      if (useDefaults) {
        await useDefaultsForSubmissions({
          scenarioId: scenarioDoc._id,
          organizationId: organizationDoc._id,
          clerkUserId: actingAdmin.clerkUserId,
        });
      }
    }

    // 5) Set outcome + create jobs + enqueue batch if configured + close scenario
    await ScenarioOutcome.createOrUpdateOutcome(
      scenarioDoc._id,
      {
        notes: outcomeNotes,
        randomEventChancePercent,
        autoGenerateSubmissionsOnOutcome: "USE_AI", // fill any missing (idempotent)
        punishAbsentStudents: "none",
      },
      organizationDoc._id,
      actingAdmin.clerkUserId
    );

    const jobs = await JobService.createJobsForScenario(
      scenarioDoc._id,
      classroom._id,
      false,
      organizationDoc._id,
      actingAdmin.clerkUserId,
      { enqueue: !useBatch }
    );

    if (useBatch) {
      await enqueueSimulationBatchSubmit({
        scenarioId: scenarioDoc._id,
        classroomId: classroom._id,
        organizationId: organizationDoc._id,
        clerkUserId: actingAdmin.clerkUserId,
      });
    }

    await scenarioDoc.close(actingAdmin.clerkUserId);

    console.log("\n✅ Done.");
    console.log(
      `Organization: ${organizationDoc.name} (clerk: ${organizationDoc.clerkOrganizationId})`
    );
    console.log(`Classroom: ${classroom._id} (${classroom.name})`);
    console.log(`Scenario: ${scenarioDoc._id} (published+closed)`);
    console.log(`Students: ${students.length}`);
    console.log(`Jobs created: ${jobs.length}`);

    const appHost = process.env.SCALE_APP_HOST || "http://localhost:5173";
    console.log(`Open class in app: ${appHost}/class/${classroom._id}`);
  } catch (err) {
    console.error("\n❌ CLI failed:", err?.message || err);
    if (err?.stack) console.error(err.stack);
    process.exitCode = 1;
  } finally {
    try {
      rl.close();
    } catch (_) {}
    try {
      await mongoose.disconnect();
    } catch (_) {}
  }
}

if (require.main === module) {
  main();
}
