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

const openai = require("../../lib/openai");

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
const Submission = require("../../services/submission/submission.model");
const VariableDefinition = require("../../services/variableDefinition/variableDefinition.model");
const {
  generateSubmissionVariablesForStoreType,
} = require("../../services/submission/autoSubmissionGenerator");
const JobService = require("../../services/job/lib/jobService");
const {
  enqueueSimulationBatchSubmit,
} = require("../../lib/queues/simulation-batch-worker");

const COLOR_ENABLED =
  !!process.stdout.isTTY &&
  String(process.env.NO_COLOR || "").trim() === "" &&
  String(process.env.TERM || "").toLowerCase() !== "dumb";

const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function color(text, ...styles) {
  if (!COLOR_ENABLED) return String(text);
  const prefix = styles
    .map((s) => ansi[s])
    .filter(Boolean)
    .join("");
  return `${prefix}${text}${ansi.reset}`;
}

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
  console.log(color(question, "bold"));
  options.forEach((opt, idx) => {
    const isDefault = idx === defaultIndex;
    const num = color(String(idx + 1), "cyan");
    const label = isDefault
      ? `${opt.label} ${color("(default)", "dim")}`
      : opt.label;
    console.log(`  ${num}) ${label}`);
  });
  const chosen = await promptInt(rl, "Select option", {
    defaultValue: defaultIndex + 1,
    min: 1,
    max: options.length,
  });
  return options[chosen - 1].value;
}

async function ensureEnrollmentInClass({
  classroomId,
  memberId,
  role,
  organizationId,
  clerkUserId,
}) {
  const existing = await Enrollment.findOne({ classroomId, userId: memberId });
  if (existing && !existing.isRemoved) return existing;
  if (existing && existing.isRemoved) {
    existing.isRemoved = false;
    existing.removedAt = null;
    existing.role = role;
    existing.organization = organizationId;
    existing.updatedBy = clerkUserId;
    existing.updatedDate = new Date();
    await existing.save();
    return existing;
  }
  const enrollment = new Enrollment({
    classroomId,
    userId: memberId,
    role,
    joinedAt: new Date(),
    isRemoved: false,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });
  await enrollment.save();
  return enrollment;
}

async function chooseOrCreateClassroom({
  rl,
  nonInteractive,
  organizationDoc,
}) {
  const existing = await Classroom.find({
    organization: organizationDoc._id,
    isActive: true,
  })
    .select("_id name description createdDate")
    .sort({ createdDate: -1 })
    .lean();

  if (nonInteractive || !rl) {
    return { mode: "create" };
  }

  const options = [
    { label: "Create a new classroom", value: { mode: "create" } },
    ...existing.map((c) => ({
      label: `Use existing: ${c.name} ${color(`(${c._id})`, "dim")}`,
      value: { mode: "existing", classroomId: c._id },
    })),
  ];

  return await promptChoice(
    rl,
    "Classroom: choose an existing classroom or create a new one",
    options,
    { defaultIndex: 0 }
  );
}

async function generateScenarioOutcomeViaAI({
  organizationName,
  classroomName,
  classroomDescription,
  storeTypeLabels,
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "description",
      "outcomeNotes",
      "randomEventChancePercent",
      "weather",
      "campusEvent",
      "footTrafficExpectation",
    ],
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      outcomeNotes: { type: "string" },
      randomEventChancePercent: { type: "number", minimum: 0, maximum: 100 },
      weather: {
        type: "string",
        enum: [
          "sunny",
          "cloudy",
          "rainy",
          "stormy",
          "snowy",
          "heatwave",
          "cold_snap",
        ],
      },
      campusEvent: { type: "string" },
      footTrafficExpectation: {
        type: "string",
        enum: ["very_low", "low", "normal", "high", "very_high"],
      },
    },
  };

  const promptPayload = {
    organizationName,
    classroomName,
    classroomDescription,
    storeTypes: storeTypeLabels,
    styleGuide: {
      scope:
        "GLOBAL campus-wide scenario (not specific to a single store type)",
      include: [
        "Weather conditions",
        "A fictional campus event (sports game, career fair, orientation, concert, etc.)",
        "Foot traffic expectations (qualitative, and explain why)",
        "Operational implications for pizza demand / staffing / inventory",
      ],
      tone: "Realistic, teaching-oriented, concise (3-6 sentences each for description and outcomeNotes)",
    },
  };

  const res = await openai.chat.completions.create({
    model: process.env.SIM_SCENARIO_MODEL || "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content:
          "You generate a GLOBAL weekly campus scenario and an instructor outcome summary for a pizza operations simulation. The scenario should reference weather, a fictional campus event, and foot traffic expectations. Return ONLY JSON matching the provided schema.",
      },
      {
        role: "user",
        content:
          "Generate a scenario and outcome for the next week.\n" +
          JSON.stringify(promptPayload, null, 2),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "scenario_outcome", schema },
    },
  });

  const content = res.choices?.[0]?.message?.content || "{}";
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse AI JSON: ${e.message}`);
  }

  const pct = Math.max(
    0,
    Math.min(100, Math.round(Number(parsed.randomEventChancePercent) || 0))
  );

  return {
    title: String(parsed.title || "").trim(),
    description: String(parsed.description || "").trim(),
    outcomeNotes: String(parsed.outcomeNotes || "").trim(),
    randomEventChancePercent: pct,
    weather: String(parsed.weather || "").trim(),
    campusEvent: String(parsed.campusEvent || "").trim(),
    footTrafficExpectation: String(parsed.footTrafficExpectation || "").trim(),
  };
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

function toObjectIdString(v) {
  try {
    return v?.toString?.() || String(v);
  } catch (_) {
    return String(v);
  }
}

async function autoCreateSubmissionsForUsersAI({
  scenarioId,
  classroomId,
  organizationId,
  clerkUserId,
  userIds,
  options = {},
}) {
  const {
    model = process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
    includeExisting = true,
  } = options;

  if (!process.env.OPENAI_API_KEY) {
    return {
      skipped: true,
      reason: "OPENAI_API_KEY not set",
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  const scenario = await Scenario.findOne({
    _id: scenarioId,
    organization: organizationId,
  });
  if (!scenario) throw new Error("Scenario not found");
  if (!scenario.isPublished || scenario.isClosed) {
    return {
      skipped: true,
      reason: "Scenario not published or already closed",
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  const hydratedScenario = await Scenario.getScenarioById(
    scenarioId,
    organizationId
  );

  const uniqueUserIds = Array.from(
    new Set((userIds || []).map((id) => toObjectIdString(id)))
  );
  if (uniqueUserIds.length === 0) {
    return {
      skipped: false,
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  // Load members for clerkUserId attribution (local-only mocked users are fine)
  const members = await Member.find({ _id: { $in: uniqueUserIds } })
    .select("_id clerkUserId")
    .lean();
  const clerkByMemberId = new Map(
    members.map((m) => [toObjectIdString(m._id), m.clerkUserId])
  );

  // Load stores for the provided users only
  const stores = await Store.find({
    classroomId,
    userId: { $in: uniqueUserIds },
  })
    .select("userId storeType")
    .lean();
  const storeByUserId = new Map(
    stores.map((s) => [toObjectIdString(s.userId), s])
  );

  // Group users by storeTypeId
  const usersByStoreTypeId = new Map(); // storeTypeId -> [{ userId, clerkUserId }]
  let missingStore = 0;
  for (const uid of uniqueUserIds) {
    const store = storeByUserId.get(uid);
    if (!store) {
      missingStore += 1;
      continue;
    }
    const storeTypeId =
      store.storeType?.toString?.() || String(store.storeType);
    if (!usersByStoreTypeId.has(storeTypeId))
      usersByStoreTypeId.set(storeTypeId, []);
    usersByStoreTypeId.get(storeTypeId).push({
      userId: uid,
      clerkUserId: clerkByMemberId.get(uid) || clerkUserId,
    });
  }

  const storeTypeIds = Array.from(usersByStoreTypeId.keys());
  const storeTypeDocs = await StoreType.find({
    _id: { $in: storeTypeIds },
    organization: organizationId,
    isActive: true,
  });
  await Promise.all(storeTypeDocs.map((st) => st._loadVariables()));
  const storeTypeById = new Map(
    storeTypeDocs.map((st) => [toObjectIdString(st._id), st])
  );

  // Generate one vars object per storeType, then reuse for all users of that type
  const varsByStoreTypeId = new Map();
  for (const storeTypeId of storeTypeIds) {
    const storeTypeDoc = storeTypeById.get(toObjectIdString(storeTypeId));
    if (!storeTypeDoc) {
      throw new Error(`StoreType not found or inactive: ${storeTypeId}`);
    }
    const vars = await generateSubmissionVariablesForStoreType({
      classroomId,
      storeTypeKey: storeTypeDoc.key,
      storeTypeVariables: storeTypeDoc.variables || {},
      scenario: hydratedScenario,
      organizationId,
      clerkUserId,
      model,
      absentPunishmentLevel: null,
    });
    varsByStoreTypeId.set(storeTypeId, vars);
  }

  let created = 0;
  let existing = 0;
  const errors = [];

  for (const [storeTypeId, users] of usersByStoreTypeId) {
    const vars = varsByStoreTypeId.get(storeTypeId);
    for (const u of users) {
      try {
        await Submission.createSubmission(
          classroomId,
          scenarioId,
          u.userId,
          vars,
          organizationId,
          u.clerkUserId,
          {
            generation: {
              method: "AI",
              meta: {
                model,
                note: "sim-cli: auto-created for simulated students",
              },
            },
          }
        );
        created += 1;
      } catch (e) {
        const msg = e?.message || String(e);
        if (includeExisting && msg.toLowerCase().includes("already exists")) {
          existing += 1;
        } else {
          errors.push({ userId: toObjectIdString(u.userId), error: msg });
        }
      }
    }
  }

  return {
    skipped: false,
    created,
    existing,
    missingStore,
    errors,
  };
}

async function createDefaultSubmissionsForUsers({
  scenarioId,
  classroomId,
  organizationId,
  clerkUserId,
  userIds,
}) {
  const scenario = await Scenario.findOne({
    _id: scenarioId,
    organization: organizationId,
  });
  if (!scenario) throw new Error("Scenario not found");
  if (!scenario.isPublished || scenario.isClosed) {
    return {
      skipped: true,
      reason: "Scenario not published or already closed",
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  const uniqueUserIds = Array.from(
    new Set((userIds || []).map((id) => toObjectIdString(id)))
  );
  if (uniqueUserIds.length === 0) {
    return {
      skipped: false,
      created: 0,
      existing: 0,
      missingStore: 0,
      errors: [],
    };
  }

  const stores = await Store.find({
    classroomId,
    userId: { $in: uniqueUserIds },
  })
    .select("userId")
    .lean();
  const storeByUserId = new Map(
    stores.map((s) => [toObjectIdString(s.userId), s])
  );

  let created = 0;
  let existing = 0;
  let missingStore = 0;
  const errors = [];

  // Apply defaults once (same for all users)
  const varsWithDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    "submission",
    {}
  );
  const validation = await VariableDefinition.validateValues(
    classroomId,
    "submission",
    varsWithDefaults
  );
  if (!validation.isValid) {
    throw new Error(
      `Defaults validation failed: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  for (const userId of uniqueUserIds) {
    try {
      const userIdStr = toObjectIdString(userId);
      if (!storeByUserId.has(userIdStr)) {
        missingStore += 1;
        errors.push({ userId: userIdStr, error: "No store found for user" });
        continue;
      }

      const existingSubmission = await Submission.findOne({
        classroomId,
        scenarioId,
        userId,
      }).select("_id");
      if (existingSubmission) {
        existing += 1;
        continue;
      }

      await Submission.createSubmission(
        classroomId,
        scenarioId,
        userId,
        varsWithDefaults,
        organizationId,
        clerkUserId,
        {
          generation: {
            method: "MANUAL",
            meta: { note: "sim-cli: defaults for simulated students" },
          },
        }
      );
      created += 1;
    } catch (e) {
      errors.push({
        userId: toObjectIdString(userId),
        error: e?.message || String(e),
      });
    }
  }

  return { skipped: false, created, existing, missingStore, errors };
}

async function createJobsForScenarioForUserIds({
  scenarioId,
  classroomId,
  organizationId,
  clerkUserId,
  userIds,
  enqueue,
  dryRun,
}) {
  const uniqueUserIds = Array.from(
    new Set((userIds || []).map((id) => toObjectIdString(id)))
  );
  if (uniqueUserIds.length === 0) return [];

  const submissions = await Submission.find({
    scenarioId,
    classroomId,
    userId: { $in: uniqueUserIds },
  })
    .select("_id userId")
    .lean();

  const jobs = [];
  for (const s of submissions) {
    const job = await JobService.createJob({
      classroomId,
      scenarioId,
      userId: s.userId,
      dryRun,
      submissionId: s._id,
      organizationId,
      clerkUserId,
      enqueue,
    });
    jobs.push(job);
  }
  return jobs;
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

    const classroomChoice = await chooseOrCreateClassroom({
      rl,
      nonInteractive: args.nonInteractive,
      organizationDoc,
    });

    // If an existing classroom already has students, use them instead of creating new ones.
    // Only prompt to create students when the classroom has zero enrolled members.
    let existingStudentUserIds = [];
    if (classroomChoice?.mode === "existing" && classroomChoice.classroomId) {
      const existingEnrollments = await Enrollment.findByClassAndRole(
        classroomChoice.classroomId,
        "member"
      )
        .select("userId")
        .lean();
      existingStudentUserIds = (existingEnrollments || [])
        .map((e) => e.userId)
        .filter(Boolean);
    }

    const shouldCreateStudents = existingStudentUserIds.length === 0;
    const studentCount = shouldCreateStudents
      ? args.nonInteractive
        ? 10
        : await promptInt(rl, "How many students?", {
            defaultValue: 10,
            min: 1,
            max: 500,
          })
      : existingStudentUserIds.length;

    const scenarioMode = args.nonInteractive
      ? "manual"
      : await promptChoice(
          rl,
          "Scenario + outcome: how should they be created?",
          [
            {
              label: "Manual (you enter title/description/outcome)",
              value: "manual",
            },
            { label: "AI (structured JSON output)", value: "ai" },
          ],
          { defaultIndex: 0 }
        );

    const submissionMode = args.nonInteractive
      ? process.env.OPENAI_API_KEY
        ? "ai"
        : "defaults"
      : await promptChoice(
          rl,
          "Submissions: how should we create submissions for the simulated students?",
          [
            { label: "AI (reuse store-type generation)", value: "ai" },
            {
              label: "Defaults (use submission variable definition defaults)",
              value: "defaults",
            },
          ],
          { defaultIndex: process.env.OPENAI_API_KEY ? 0 : 1 }
        );

    let scenarioTitle = "Week 1: Demand Shock & Supply Constraints";
    let scenarioDescription =
      "A sudden demand spike hits the neighborhood while a key ingredient supplier becomes unreliable. Students must balance staffing, inventory, and pricing decisions under uncertainty.";
    let outcomeNotes =
      "The week ended with volatile demand and supplier variability. Strong plans balanced service level with spoilage risk.";
    let randomEventChancePercent = 0;

    if (scenarioMode === "manual") {
      scenarioTitle = await promptLine(rl, "Scenario title", {
        defaultValue: scenarioTitle,
      });
      scenarioDescription = await promptLine(rl, "Scenario description", {
        defaultValue: scenarioDescription,
      });
      outcomeNotes = await promptLine(
        rl,
        "Scenario outcome notes (shown to students)",
        { defaultValue: outcomeNotes }
      );
      randomEventChancePercent = args.nonInteractive
        ? 0
        : await promptInt(rl, "Random event chance percent (0-100)", {
            defaultValue: 0,
            min: 0,
            max: 100,
          });
    }

    const simulationMode = String(process.env.SIMULATION_MODE || "direct");
    const useBatch = simulationMode === "batch";

    console.log("\nPlanned actions:");
    console.log(`- dryRun: ${args.dryRun ? "YES" : "no"}`);
    console.log(
      `- org: existing (${organizationDoc.name}) (${useBatch ? "batch ledger mode" : "direct ledger mode"})`
    );
    console.log(
      `- classroom: ${
        classroomChoice?.mode === "existing"
          ? `existing (${classroomChoice.classroomId})`
          : "create new"
      } (template applied)`
    );
    console.log(
      `- students: ${
        shouldCreateStudents
          ? `${studentCount} (create local-only mocked clerkUserId)`
          : `${studentCount} (use existing students in classroom)`
      }`
    );
    console.log(
      `- scenario: ${scenarioMode === "ai" ? "AI" : "manual"} (published)`
    );
    console.log(
      `- submissions: ${
        submissionMode === "ai" ? "AI" : "defaults"
      } (sim students only)`
    );
    if (scenarioMode === "manual") {
      console.log(
        `- outcome: randomEventChancePercent=${randomEventChancePercent}`
      );
    }
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

    // 1) Create or load classroom under selected organization
    let classroom = null;
    if (classroomChoice?.mode === "existing" && classroomChoice.classroomId) {
      classroom = await Classroom.findOne({
        _id: classroomChoice.classroomId,
        organization: organizationDoc._id,
      });
      if (!classroom) {
        throw new Error(
          "Selected classroom not found in selected organization"
        );
      }
    } else {
      const classroomSuffix = await findNextSuffixNumber({
        model: Classroom,
        field: "name",
        prefix: "classroom",
      });
      const classroomName = `classroom_${classroomSuffix}`;

      classroom = await Classroom.create({
        name: classroomName,
        description: `Simulation CLI created on ${new Date().toISOString()}`,
        isActive: true,
        ownership: actingAdmin._id,
        organization: organizationDoc._id,
        createdBy: actingAdmin.clerkUserId,
        updatedBy: actingAdmin.clerkUserId,
      });

      await ensureDefaultTemplateAppliedToClassroom({
        classroomId: classroom._id,
        organizationId: organizationDoc._id,
        clerkUserId: actingAdmin.clerkUserId,
      });
    }

    await ensureEnrollmentInClass({
      classroomId: classroom._id,
      memberId: actingAdmin._id,
      role: "admin",
      organizationId: organizationDoc._id,
      clerkUserId: actingAdmin.clerkUserId,
    });

    // 2) Create students + enroll + stores
    const seedPrefix = `sim_${toSafeSlugPart(organizationDoc.name) || "org"}_${randomUUID().slice(0, 8)}`;

    let students = [];
    let createdNewStudents = false;
    if (shouldCreateStudents) {
      createdNewStudents = true;
      students = await createLocalOnlyStudents({
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
    } else {
      // Use existing students already enrolled in this classroom.
      students = await Member.find({ _id: { $in: existingStudentUserIds } })
        .select("_id clerkUserId firstName lastName username")
        .lean();
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

    if (createdNewStudents) {
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
    }

    // If AI scenario mode, generate now that we have classroom + store types.
    if (scenarioMode === "ai") {
      const generated = await generateScenarioOutcomeViaAI({
        organizationName: organizationDoc.name,
        classroomName: classroom.name,
        classroomDescription: classroom.description || "",
        storeTypeLabels: storeTypes
          .map((st) => st.label || st.key)
          .filter(Boolean),
      });

      console.log("\nAI generated scenario/outcome:");
      console.log(color("Title: ", "bold") + generated.title);
      console.log(color("Weather: ", "bold") + (generated.weather || ""));
      console.log(
        color("Campus event: ", "bold") + (generated.campusEvent || "")
      );
      console.log(
        color("Foot traffic: ", "bold") +
          (generated.footTrafficExpectation || "")
      );
      console.log(color("Description: ", "bold") + generated.description);
      console.log(color("Outcome notes: ", "bold") + generated.outcomeNotes);
      console.log(
        color("Random event chance percent: ", "bold") +
          String(generated.randomEventChancePercent)
      );

      const ok = args.nonInteractive
        ? true
        : await promptYesNo(rl, "Use these values?", { defaultValue: true });

      if (!ok) {
        // Fall back to manual edits
        scenarioTitle = await promptLine(rl, "Scenario title", {
          defaultValue: generated.title,
        });
        scenarioDescription = await promptLine(rl, "Scenario description", {
          defaultValue: generated.description,
        });
        outcomeNotes = await promptLine(
          rl,
          "Scenario outcome notes (shown to students)",
          { defaultValue: generated.outcomeNotes }
        );
        randomEventChancePercent = await promptInt(
          rl,
          "Random event chance percent (0-100)",
          {
            defaultValue: generated.randomEventChancePercent,
            min: 0,
            max: 100,
          }
        );
      } else {
        scenarioTitle = generated.title;
        scenarioDescription = generated.description;
        outcomeNotes = generated.outcomeNotes;
        randomEventChancePercent = generated.randomEventChancePercent;
      }
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

    // 4) Create submissions (ONLY for the newly-created simulated students)
    const simStudentIds = students.map((s) => s._id);
    if (submissionMode === "defaults") {
      await createDefaultSubmissionsForUsers({
        scenarioId: scenarioDoc._id,
        classroomId: classroom._id,
        organizationId: organizationDoc._id,
        clerkUserId: actingAdmin.clerkUserId,
        userIds: simStudentIds,
      });
    } else {
      const subGen = await autoCreateSubmissionsForUsersAI({
        scenarioId: scenarioDoc._id,
        classroomId: classroom._id,
        organizationId: organizationDoc._id,
        clerkUserId: actingAdmin.clerkUserId,
        userIds: simStudentIds,
        options: { includeExisting: true },
      });

      if (subGen?.skipped) {
        console.log(`Submissions AI generation skipped: ${subGen.reason}`);
        const useDefaults = args.nonInteractive
          ? true
          : await promptYesNo(
              rl,
              "Generate submissions with defaults instead?",
              { defaultValue: true }
            );
        if (useDefaults) {
          await createDefaultSubmissionsForUsers({
            scenarioId: scenarioDoc._id,
            classroomId: classroom._id,
            organizationId: organizationDoc._id,
            clerkUserId: actingAdmin.clerkUserId,
            userIds: simStudentIds,
          });
        }
      }
    }

    // 5) Set outcome + create jobs + enqueue batch if configured + close scenario
    await ScenarioOutcome.createOrUpdateOutcome(
      scenarioDoc._id,
      {
        notes: outcomeNotes,
        randomEventChancePercent,
        // IMPORTANT: In simulation runs, we do NOT auto-generate missing submissions on outcome.
        // Students who did not submit should be skipped (no submission => no job).
        autoGenerateSubmissionsOnOutcome: null,
      },
      organizationDoc._id,
      actingAdmin.clerkUserId
    );

    const jobs = await createJobsForScenarioForUserIds({
      scenarioId: scenarioDoc._id,
      classroomId: classroom._id,
      organizationId: organizationDoc._id,
      clerkUserId: actingAdmin.clerkUserId,
      userIds: simStudentIds,
      enqueue: !useBatch,
      dryRun: false,
    });

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
    console.log(`Jobs created (sim students): ${jobs.length}`);

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
