const express = require("express");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

// Support requiring JSX/TSX components in node
try {
  require("esbuild-register/dist/node").register({
    extensions: [".jsx", ".tsx"],
    target: "es2019",
  });
} catch (_) {}

// Load models and configs
require("../../lib/load-local-env")();
require("../../models");

const { renderReactEmail } = require("../../lib/emails/reactRenderer");
const Organization = require("../../services/organizations/organization.model");
const Member = require("../../services/members/member.model");
const Classroom = require("../../services/classroom/classroom.model");
const Enrollment = require("../../services/enrollment/enrollment.model");
const ClassroomTemplate = require("../../services/classroomTemplate/classroomTemplate.model");
const ProfileType = require("../../services/profileType/profileType.model");
const Profile = require("../../services/profile/profile.model");
const Challenge = require("../../services/challenge/challenge.model");
const Outcome = require("../../services/outcome/outcome.model");
const LedgerEntry = require("../../services/ledger/ledger.model");
const Decision = require("../../services/decision/decision.model");
const VariableDefinition = require("../../services/variableDefinition/variableDefinition.model");
const JobService = require("../../services/job/lib/jobService");
const SimulationJob = require("../../services/job/job.model");
const { enqueueSimulationBatchSubmit } = require("../../lib/queues/simulation-batch-worker");
const openai = require("../../lib/openai");
const {
  assertLocalRequest,
  assertSafeSimulationEnvironment,
  assertSimulationRoster,
  parseStudentCount,
} = require("./simulation-safety");

assertSafeSimulationEnvironment();

const app = express();
const PORT = process.env.PORT_ADMIN || 4001;

app.use(express.json());
app.use("/api", (req, res, next) => {
  try {
    assertLocalRequest(req);
    next();
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Helper methods from sim-cli
function toSafeSlugPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function toDisplayName(member) {
  const first = member?.firstName || "";
  const last = member?.lastName || "";
  const name = `${first} ${last}`.trim();
  return name || member?.username || member?.clerkUserId || String(member?._id);
}

async function connectMongo() {
  if (mongoose.connection.readyState === 1) return;
  let url = process.env.MONGO_URL || process.env.MONGO_URI;
  if (!url && process.env.MONGO_SCHEME) {
    const {
      MONGO_SCHEME,
      MONGO_USERNAME,
      MONGO_PASSWORD,
      MONGO_HOSTNAME,
      MONGO_DB,
    } = process.env;
    url = `${MONGO_SCHEME}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DB}?authSource=admin`;
  }
  if (!url) {
    url = "mongodb://localhost:27017/scale-ai-api";
  }
  await mongoose.connect(url);
}

async function ensureEnrollmentInClass({ classroomId, memberId, role, organizationId, clerkUserId }) {
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

async function ensureDefaultTemplateAppliedToClassroom({ classroomId, organizationId, clerkUserId }) {
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
      isSimulationUser: true,
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

async function generateScenarioOutcomeViaAI({ organizationName, classroomName, classroomDescription, storeTypeLabels }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "description", "outcomeNotes", "randomEventChancePercent", "weather", "campusEvent", "footTrafficExpectation"],
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      outcomeNotes: { type: "string" },
      randomEventChancePercent: { type: "number", minimum: 0, maximum: 100 },
      weather: {
        type: "string",
        enum: ["sunny", "cloudy", "rainy", "stormy", "snowy", "heatwave", "cold_snap"],
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
    profileTypes: storeTypeLabels,
    styleGuide: {
      scope: "GLOBAL campus-wide challenge (not specific to a single profile type)",
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
        content: "You generate a GLOBAL weekly campus challenge and an instructor outcome summary for a pizza operations simulation. Return ONLY JSON.",
      },
      {
        role: "user",
        content: "Generate a challenge and outcome for the next week.\n" + JSON.stringify(promptPayload, null, 2),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "scenario_outcome", schema },
    },
  });

  const content = res.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  const pct = Math.max(0, Math.min(100, Math.round(Number(parsed.randomEventChancePercent) || 0)));

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

async function autoCreateSubmissionsForUsersAI({ challengeId, classroomId, organizationId, clerkUserId, userIds, options = {} }) {
  const { model = process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini", includeExisting = true } = options;

  if (!process.env.OPENAI_API_KEY) {
    return { skipped: true, reason: "OPENAI_API_KEY not set" };
  }

  const challenge = await Challenge.findOne({ _id: challengeId, organization: organizationId });
  if (!challenge) throw new Error("Challenge not found");

  const hydratedScenario = await Challenge.getScenarioById(challengeId, organizationId);
  const uniqueUserIds = Array.from(new Set((userIds || []).map((id) => toObjectIdString(id))));

  const members = await Member.find({ _id: { $in: uniqueUserIds } }).select("_id clerkUserId").lean();
  const clerkByMemberId = new Map(members.map((m) => [toObjectIdString(m._id), m.clerkUserId]));

  const profiles = await Profile.find({ classroomId, userId: { $in: uniqueUserIds } }).select("userId profileType").lean();
  const storeByUserId = new Map(profiles.map((s) => [toObjectIdString(s.userId), s]));

  const usersByStoreTypeId = new Map();
  let missingStore = 0;
  for (const uid of uniqueUserIds) {
    const profile = storeByUserId.get(uid);
    if (!profile) {
      missingStore += 1;
      continue;
    }
    const storeTypeId = profile.profileType?.toString?.() || String(profile.profileType);
    if (!usersByStoreTypeId.has(storeTypeId)) usersByStoreTypeId.set(storeTypeId, []);
    usersByStoreTypeId.get(storeTypeId).push({
      userId: uid,
      clerkUserId: clerkByMemberId.get(uid) || clerkUserId,
    });
  }

  const storeTypeIds = Array.from(usersByStoreTypeId.keys());
  const storeTypeDocs = await ProfileType.find({ _id: { $in: storeTypeIds }, organization: organizationId, isActive: true });
  await Promise.all(storeTypeDocs.map((st) => st._loadVariables()));
  const storeTypeById = new Map(storeTypeDocs.map((st) => [toObjectIdString(st._id), st]));

  const varsByStoreTypeId = new Map();
  for (const storeTypeId of storeTypeIds) {
    const storeTypeDoc = storeTypeById.get(toObjectIdString(storeTypeId));
    if (!storeTypeDoc) throw new Error(`ProfileType not found: ${storeTypeId}`);
    const vars = await Decision.generateSubmissionVariablesForStoreType({
      classroomId,
      storeTypeKey: storeTypeDoc.key,
      storeTypeVariables: storeTypeDoc.variables || {},
      challenge: hydratedScenario,
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
        await Decision.createSubmission(classroomId, challengeId, u.userId, vars, organizationId, u.clerkUserId, {
          generation: {
            method: "AI",
            meta: { model, note: "admin-app: auto-created for simulation" },
          },
        });
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

  return { skipped: false, created, existing, missingStore, errors };
}

async function createDefaultSubmissionsForUsers({ challengeId, classroomId, organizationId, clerkUserId, userIds }) {
  const challenge = await Challenge.findOne({ _id: challengeId, organization: organizationId });
  if (!challenge) throw new Error("Challenge not found");

  const uniqueUserIds = Array.from(new Set((userIds || []).map((id) => toObjectIdString(id))));
  const profiles = await Profile.find({ classroomId, userId: { $in: uniqueUserIds } }).select("userId").lean();
  const storeByUserId = new Map(profiles.map((s) => [toObjectIdString(s.userId), s]));

  let created = 0;
  let existing = 0;
  let missingStore = 0;
  const errors = [];

  const varsWithDefaults = await VariableDefinition.applyDefaults(classroomId, "decision", {});
  const validation = await VariableDefinition.validateValues(classroomId, "decision", varsWithDefaults);
  if (!validation.isValid) {
    throw new Error(`Defaults validation failed: ${validation.errors.map((e) => e.message).join(", ")}`);
  }

  for (const userId of uniqueUserIds) {
    try {
      const userIdStr = toObjectIdString(userId);
      if (!storeByUserId.has(userIdStr)) {
        missingStore += 1;
        errors.push({ userId: userIdStr, error: "No profile found for user" });
        continue;
      }

      const existingSubmission = await Decision.findOne({ classroomId, challengeId, userId }).select("_id");
      if (existingSubmission) {
        existing += 1;
        continue;
      }

      await Decision.createSubmission(classroomId, challengeId, userId, varsWithDefaults, organizationId, clerkUserId, {
        generation: {
          method: "MANUAL",
          meta: { note: "admin-app: defaults for simulation" },
        },
      });
      created += 1;
    } catch (e) {
      errors.push({ userId: toObjectIdString(userId), error: e?.message || String(e) });
    }
  }

  return { skipped: false, created, existing, missingStore, errors };
}

async function createJobsForScenarioForUserIds({ challengeId, classroomId, organizationId, clerkUserId, userIds, enqueue, dryRun }) {
  const uniqueUserIds = Array.from(new Set((userIds || []).map((id) => toObjectIdString(id))));
  if (uniqueUserIds.length === 0) return [];

  const decisions = await Decision.find({ challengeId, classroomId, userId: { $in: uniqueUserIds } })
    .select("_id userId")
    .lean();

  const jobs = [];
  for (const s of decisions) {
    const job = await JobService.createJob({
      classroomId,
      challengeId,
      userId: s.userId,
      dryRun,
      decisionId: s._id,
      organizationId,
      clerkUserId,
      enqueue,
    });
    jobs.push(job);
  }
  return jobs;
}

// REST endpoints for Admin interface
app.get("/api/admins", async (req, res) => {
  try {
    await connectMongo();
    const admins = await Member.find({
      organizationMemberships: { $elemMatch: { role: "org:admin" } },
    })
      .select("_id clerkUserId firstName lastName username maskedEmail organizationMemberships")
      .lean();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/organizations", async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) return res.status(400).json({ error: "adminId is required" });

    await connectMongo();
    const admin = await Member.findById(adminId).lean();
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const memberships = admin.organizationMemberships || [];
    const adminOrgIds = Array.from(
      new Set(
        memberships
          .filter((m) => m && m.role === "org:admin" && m.organizationId)
          .map((m) => String(m.organizationId))
      )
    );

    const orgDocs = await Organization.find({ _id: { $in: adminOrgIds } })
      .select("_id name slug clerkOrganizationId imageUrl")
      .lean();

    res.json(orgDocs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/classrooms", async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    await connectMongo();
    const classrooms = await Classroom.find({
      organization: orgId,
      isActive: true,
      isSimulationClassroom: true,
    })
      .select("_id name description createdDate")
      .sort({ createdDate: -1 })
      .lean();

    res.json(classrooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// React Email templates and fixtures
const templateSlugs = ["challenge-created", "challenge-closed"];

app.get("/api/emails/templates", (req, res) => {
  res.json(templateSlugs);
});

// Load a specific preview fixture JSON
app.get("/api/emails/fixture/:slug", (req, res) => {
  const { slug } = req.params;
  const fixturePath = path.join(__dirname, "fixtures", `${slug}.json`);
  if (fs.existsSync(fixturePath)) {
    try {
      const raw = fs.readFileSync(fixturePath, "utf-8");
      return res.json(JSON.parse(raw));
    } catch (e) {
      return res.status(500).json({ error: `Failed to read fixture: ${e.message}` });
    }
  }
  res.json({});
});

app.post("/api/emails/render/:slug", async (req, res) => {
  const { slug } = req.params;
  const props = req.body || {};
  try {
    const rendered = await renderReactEmail(slug, props);
    res.json(rendered);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Real-time Simulation Engine Event Stream (SSE)
app.post("/api/simulation/run", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendLog = (message, status = "running") => {
    res.write(`data: ${JSON.stringify({ log: message, status })}\n\n`);
  };

  try {
    const {
      adminId,
      orgId,
      classroomId,
      classroomMode,
      classroomName,
      studentCount,
      scenarioMode,
      scenarioTitle,
      scenarioDescription,
      outcomeNotes,
      randomEventChance,
      submissionMode,
      missingSubmissionsMode,
      simulationMode,
    } = req.body || {};

    if (!adminId || !orgId) {
      throw new Error("adminId and orgId are required parameters");
    }

    sendLog("🔌 Connecting database...");
    await connectMongo();

    // Fetch Acting Admin
    const actingAdmin = await Member.findById(adminId).lean();
    if (!actingAdmin) throw new Error("Acting admin member not found");
    sendLog(`Acting Admin: ${toDisplayName(actingAdmin)} (${actingAdmin._id})`);

    // Fetch Organization
    const organizationDoc = await Organization.findById(orgId).lean();
    if (!organizationDoc) throw new Error("Organization not found");
    const canAdministerOrganization = (actingAdmin.organizationMemberships || []).some(
      (membership) =>
        membership?.role === "org:admin" &&
        String(membership.organizationId) === String(organizationDoc._id),
    );
    if (!canAdministerOrganization) {
      throw new Error("Selected administrator does not administer this organization");
    }
    sendLog(`Organization: ${organizationDoc.name} (${organizationDoc._id})`);

    // Create or select classroom
    let classroom;
    if (classroomMode === "existing" && classroomId) {
      classroom = await Classroom.findOne({
        _id: classroomId,
        organization: organizationDoc._id,
        isSimulationClassroom: true,
      });
      if (!classroom) throw new Error("Selected classroom not found");
      sendLog(`Using existing classroom: ${classroom.name}`);
    } else {
      const name = classroomName?.trim() || `classroom_${await findNextSuffixNumber({ model: Classroom, field: "name", prefix: "classroom" })}`;
      sendLog(`Creating new classroom "${name}"...`);
      classroom = await Classroom.create({
        name,
        description: `Console simulation round run on ${new Date().toLocaleDateString()}`,
        isActive: true,
        isSimulationClassroom: true,
        ownership: actingAdmin._id,
        organization: organizationDoc._id,
        createdBy: actingAdmin.clerkUserId,
        updatedBy: actingAdmin.clerkUserId,
      });

      sendLog("Enforcing template configs...");
      await ensureDefaultTemplateAppliedToClassroom({
        classroomId: classroom._id,
        organizationId: organizationDoc._id,
        clerkUserId: actingAdmin.clerkUserId,
      });
    }

    sendLog("Verifying admin enrollment...");
    await ensureEnrollmentInClass({
      classroomId: classroom._id,
      memberId: actingAdmin._id,
      role: "admin",
      organizationId: organizationDoc._id,
      clerkUserId: actingAdmin.clerkUserId,
    });

    // Enrolled students checking
    const existingEnrollments = await Enrollment.findByClassAndRole(classroom._id, "member").select("userId").lean();
    const existingStudentUserIds = (existingEnrollments || []).map((e) => e.userId).filter(Boolean);
    const shouldCreateStudents = existingStudentUserIds.length === 0;
    const finalStudentCount = parseStudentCount(studentCount);

    let students = [];
    if (shouldCreateStudents) {
      sendLog(`Creating ${finalStudentCount} mock student accounts...`);
      const seedPrefix = `sim_${toSafeSlugPart(organizationDoc.name) || "org"}_${randomUUID().slice(0, 8)}`;
      students = await createLocalOnlyStudents({
        organizationDoc,
        count: finalStudentCount,
        seedPrefix,
      });

      sendLog("Enrolling student accounts...");
      for (const s of students) {
        await Enrollment.enrollUser(classroom._id, s._id, "member", organizationDoc._id, actingAdmin.clerkUserId);
      }
    } else {
      students = await Member.find({ _id: { $in: existingStudentUserIds } })
        .select("_id clerkUserId isSimulationUser firstName lastName username")
        .lean();
      assertSimulationRoster(students, finalStudentCount);
      sendLog(`Found ${students.length} existing students enrolled in classroom.`);
    }

    const profileTypes = await ProfileType.getStoreTypesByClassroom(classroom._id, organizationDoc._id);
    if (!profileTypes.length) {
      throw new Error("No ProfileTypes exist for this classroom.");
    }

    if (shouldCreateStudents) {
      sendLog("Seeding stores and week 0 ledgers...");
      for (let i = 0; i < students.length; i++) {
        const s = students[i];
        const st = profileTypes[i % profileTypes.length];
        const store = await Profile.createStore(
          classroom._id,
          s._id,
          {
            shopName: `Sim Pizza ${toSafeSlugPart(organizationDoc.name) || "org"}-${i + 1}`,
            storeDescription: "Auto-created by simulation panel.",
            storeLocation: "Campus Town",
            studentId: `student_${String(i + 1).padStart(3, "0")}`,
            profileType: st._id,
            variables: {},
          },
          organizationDoc._id,
          actingAdmin.clerkUserId
        );

        const hasInitial = await LedgerEntry.findOne({ classroomId: classroom._id, userId: s._id, challengeId: null }).select("_id").lean();
        if (!hasInitial && store) {
          const profileId = store._id || store.id;
          await Profile.seedInitialLedgerEntry(profileId, classroom._id, s._id, organizationDoc._id, actingAdmin.clerkUserId);
        }
      }
    }

    let challengeTitle = scenarioTitle || "Back to School Rush";
    let challengeDescription = scenarioDescription || "Prepare for orders constraints.";
    let notes = outcomeNotes || "Week ended successfully.";
    let pct = parseInt(randomEventChance, 10) || 0;

    if (scenarioMode === "ai") {
      sendLog("Generating scenario parameters via OpenAI...");
      const aiGen = await generateScenarioOutcomeViaAI({
        organizationName: organizationDoc.name,
        classroomName: classroom.name,
        classroomDescription: classroom.description || "",
        storeTypeLabels: profileTypes.map((st) => st.label || st.key).filter(Boolean),
      });
      challengeTitle = aiGen.title;
      challengeDescription = aiGen.description;
      notes = aiGen.outcomeNotes;
      pct = aiGen.randomEventChancePercent;
      sendLog(`AI Scenario: ${challengeTitle}`);
    }

    sendLog(`Creating scenario challenge: "${challengeTitle}"...`);
    const scenarioObj = await Challenge.createScenario(
      classroom._id,
      { title: challengeTitle, description: challengeDescription, variables: {} },
      organizationDoc._id,
      actingAdmin.clerkUserId
    );
    const challengeId = scenarioObj._id || scenarioObj.id;

    sendLog("Publishing challenge scenario...");
    await Challenge.updateOne(
      { _id: challengeId, organization: organizationDoc._id },
      {
        $set: {
          isPublished: true,
          suppressNotifications: true,
          updatedBy: actingAdmin.clerkUserId,
          updatedDate: new Date(),
        },
      }
    );
    const scenarioDoc = await Challenge.findById(challengeId);

    const simStudentIds = students.map((s) => s._id);
    sendLog(`Generating submissions using mode: ${submissionMode}...`);
    if (submissionMode === "defaults") {
      await createDefaultSubmissionsForUsers({
        challengeId: scenarioDoc._id,
        classroomId: classroom._id,
        organizationId: organizationDoc._id,
        clerkUserId: actingAdmin.clerkUserId,
        userIds: simStudentIds,
      });
    } else {
      const subAI = await autoCreateSubmissionsForUsersAI({
        challengeId: scenarioDoc._id,
        classroomId: classroom._id,
        organizationId: organizationDoc._id,
        clerkUserId: actingAdmin.clerkUserId,
        userIds: simStudentIds,
        options: { includeExisting: true },
      });
      if (subAI?.skipped) {
        sendLog(`AI submissions generation failed: ${subAI.reason}. Generating default values instead.`);
        await createDefaultSubmissionsForUsers({
          challengeId: scenarioDoc._id,
          classroomId: classroom._id,
          organizationId: organizationDoc._id,
          clerkUserId: actingAdmin.clerkUserId,
          userIds: simStudentIds,
        });
      }
    }

    sendLog("Configuring scenario outcome...");
    const missingMode = missingSubmissionsMode === "null" || !missingSubmissionsMode ? null : missingSubmissionsMode;
    await Outcome.createOrUpdateOutcome(
      scenarioDoc._id,
      { notes, randomEventChancePercent: pct, autoGenerateSubmissionsOnOutcome: missingMode },
      organizationDoc._id,
      actingAdmin.clerkUserId
    );

    sendLog("Triggering simulation jobs...");
    const useBatch = simulationMode === "batch";
    const jobsCreated = await createJobsForScenarioForUserIds({
      challengeId: scenarioDoc._id,
      classroomId: classroom._id,
      organizationId: organizationDoc._id,
      clerkUserId: actingAdmin.clerkUserId,
      userIds: simStudentIds,
      enqueue: !useBatch,
      dryRun: false,
    });

    if (useBatch) {
      sendLog("Enqueuing batch submit job...");
      await enqueueSimulationBatchSubmit({
        challengeId: scenarioDoc._id,
        classroomId: classroom._id,
        organizationId: organizationDoc._id,
        clerkUserId: actingAdmin.clerkUserId,
      });
    }

    sendLog("Closing challenge and generating ledger entries...");
    await scenarioDoc.close(actingAdmin.clerkUserId);

    sendLog(
      `✅ Simulation jobs submitted (${jobsCreated.length} students). Results will complete in the worker.`,
      "completed",
    );
    res.write(`data: ${JSON.stringify({ done: true, status: "submitted", jobCount: jobsCreated.length, classroomId: classroom._id, challengeId: scenarioDoc._id })}\n\n`);
    res.end();
  } catch (err) {
    sendLog(`❌ Execution failed: ${err.message}`, "failed");
    res.end();
  }
});

app.post("/api/simulation/cleanup", async (req, res) => {
  try {
    const { adminId, orgId, classroomId } = req.body || {};
    if (!adminId || !orgId || !classroomId) {
      return res.status(400).json({
        error: "adminId, orgId, and classroomId are required",
      });
    }

    await connectMongo();
    const [actingAdmin, organizationDoc, classroom] = await Promise.all([
      Member.findById(adminId).lean(),
      Organization.findById(orgId).lean(),
      Classroom.findOne({
        _id: classroomId,
        organization: orgId,
        isSimulationClassroom: true,
      }).lean(),
    ]);
    if (!actingAdmin || !organizationDoc || !classroom) {
      return res.status(404).json({ error: "Simulation classroom not found" });
    }
    const canAdministerOrganization = (actingAdmin.organizationMemberships || []).some(
      (membership) =>
        membership?.role === "org:admin" &&
        String(membership.organizationId) === String(organizationDoc._id),
    );
    if (!canAdministerOrganization) {
      return res.status(403).json({
        error: "Selected administrator does not administer this organization",
      });
    }

    const activeJobs = await SimulationJob.countDocuments({
      classroomId,
      status: { $in: ["pending", "running"] },
    });
    if (activeJobs > 0) {
      return res.status(409).json({
        error: `Cannot clean up while ${activeJobs} simulation jobs are still active`,
      });
    }

    const enrollments = await Enrollment.findByClassAndRole(classroomId, "member")
      .select("userId")
      .lean();
    const studentIds = enrollments.map((enrollment) => enrollment.userId).filter(Boolean);
    const students = await Member.find({ _id: { $in: studentIds } })
      .select("_id clerkUserId isSimulationUser")
      .lean();
    assertSimulationRoster(students, studentIds.length);

    const stats = await Classroom.deleteClassroom(classroomId, orgId);
    const stillEnrolledIds = await Enrollment.distinct("userId", {
      userId: { $in: studentIds },
    });
    const stillEnrolledSet = new Set(stillEnrolledIds.map(String));
    const orphanedSimulationUserIds = students
      .filter((student) => !stillEnrolledSet.has(String(student._id)))
      .filter((student) => student.isSimulationUser)
      .map((student) => student._id);
    const memberResult = await Member.deleteMany({
      _id: { $in: orphanedSimulationUserIds },
      isSimulationUser: true,
    });

    res.json({
      ...stats,
      simulationMembersDeleted: memberResult.deletedCount || 0,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Serve frontend in production/preview
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 Admin server running at http://127.0.0.1:${PORT}`);
});
