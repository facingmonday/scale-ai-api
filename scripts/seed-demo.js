#!/usr/bin/env node
/**
 * Demo seed script for SCALE.ai
 *
 * Creates (for ONE existing org admin):
 * - 6 classrooms
 * - each with 6 completed scenarios
 * - each classroom with 100 students (members) enrolled
 * - each student gets a store (various store types)
 * - 4 variable definitions each for store/scenario/submission
 * - submissions + completed simulation jobs + ledger entries for each scenario/student
 *
 * Safety:
 * - Will only seed if at least one existing Member has org role "org:admin"
 * - Uses a seed tag and will not create duplicates unless --force is provided
 *
 * Usage:
 *   node scripts/seed-demo.js
 *   node scripts/seed-demo.js --admin=user_xxx
 *   node scripts/seed-demo.js --force
 *   node scripts/seed-demo.js --dry-run
 */
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config();
// Ensure models are registered
require(path.join(__dirname, "..", "models"));

const Classroom = require("../services/classroom/classroom.model");
const Scenario = require("../services/scenario/scenario.model");
const Submission = require("../services/submission/submission.model");
const Store = require("../services/store/store.model");
const Enrollment = require("../services/enrollment/enrollment.model");
const VariableDefinition = require("../services/variableDefinition/variableDefinition.model");
const VariableValue = require("../services/variableDefinition/variableValue.model");
const ScenarioOutcome = require("../services/scenarioOutcome/scenarioOutcome.model");
const LedgerEntry = require("../services/ledger/ledger.model");
const SimulationJob = require("../services/job/job.model");
const Member = require("../services/members/member.model");

const {
  getPreset,
  getAvailableStoreTypes,
} = require("../services/store/storeTypePresets");

function parseArgs(argv) {
  const args = {
    admin: null,
    force: false,
    dryRun: false,
<<<<<<< HEAD
    classrooms: 2,
    scenariosPerClassroom: 6,
    studentsPerClassroom: 100,
=======
    classrooms: 1,
    scenariosPerClassroom: 1,
    studentsPerClassroom: 1,
>>>>>>> develop
  };

  for (const raw of argv.slice(2)) {
    if (raw === "--force") args.force = true;
    else if (raw === "--dry-run") args.dryRun = true;
    else if (raw.startsWith("--admin="))
      args.admin = raw.split("=").slice(1).join("=");
    else if (raw.startsWith("--classrooms="))
      args.classrooms = parseInt(raw.split("=").pop(), 10);
    else if (raw.startsWith("--scenarios="))
      args.scenariosPerClassroom = parseInt(raw.split("=").pop(), 10);
    else if (raw.startsWith("--students="))
      args.studentsPerClassroom = parseInt(raw.split("=").pop(), 10);
    else if (raw === "--help" || raw === "-h") {
      console.log(`\nSCALE.ai demo seed\n
Options:
  --admin=<clerkUserId>   seed for a specific existing org admin (clerkUserId)
  --force                delete prior seed data for this admin and recreate
  --dry-run              connect + validate, but do not write
  --classrooms=<n>        default 6
  --scenarios=<n>         scenarios per classroom, default 6
  --students=<n>          students per classroom, default 100\n`);
      process.exit(0);
    }
  }

  if (!Number.isFinite(args.classrooms) || args.classrooms < 1)
    args.classrooms = 6;
  if (
    !Number.isFinite(args.scenariosPerClassroom) ||
    args.scenariosPerClassroom < 1
  )
    args.scenariosPerClassroom = 6;
  if (
    !Number.isFinite(args.studentsPerClassroom) ||
    args.studentsPerClassroom < 1
  )
    args.studentsPerClassroom = 100;

  return args;
}

function getMongoUrlFromEnv() {
  const direct = process.env.MONGO_URL || process.env.MONGO_URI;
  if (direct) return direct;

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

function makeRng(seed) {
  // Deterministic LCG (good enough for demo data)
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function buildSeedTag(adminClerkUserId, organizationId) {
  return `SEED_DEMO_V1::admin=${adminClerkUserId}::org=${organizationId.toString()}`;
}

async function findTargetAdmin({ adminClerkUserId }) {
  if (adminClerkUserId) {
    const m = await Member.findOne({ clerkUserId: adminClerkUserId });
    return m || null;
  }

  // Find any member with an org:admin membership
  const m = await Member.findOne({
    "organizationMemberships.role": "org:admin",
  }).sort({ _id: 1 });
  return m || null;
}

function pickAdminOrgMembership(member) {
  if (!member?.organizationMemberships?.length) return null;
  return (
    member.organizationMemberships.find((m) => m.role === "org:admin") ||
    member.organizationMemberships[0] ||
    null
  );
}

async function deleteSeedDataForAdmin({
  seedTag,
  organizationId,
  adminMemberId,
}) {
  // Find seed classrooms first
  const seedClassrooms = await Classroom.find({
    organization: organizationId,
    ownership: adminMemberId,
    description: seedTag,
  }).select("_id");

  if (seedClassrooms.length === 0) return { deleted: false, classrooms: 0 };

  const classroomIds = seedClassrooms.map((c) => c._id);

  const scenarios = await Scenario.find({
    classroomId: { $in: classroomIds },
  }).select("_id");
  const scenarioIds = scenarios.map((s) => s._id);

  const submissions = await Submission.find({
    classroomId: { $in: classroomIds },
  }).select("_id");
  const submissionIds = submissions.map((s) => s._id);

  const stores = await Store.find({
    classroomId: { $in: classroomIds },
  }).select("_id");
  const storeIds = stores.map((s) => s._id);

  const ownerIdsForVariables = [...scenarioIds, ...submissionIds, ...storeIds];

  // Order matters a bit due to unique constraints and references, but we're deleting so it's fine.
  await Promise.allSettled([
    ScenarioOutcome.deleteMany({ scenarioId: { $in: scenarioIds } }),
    SimulationJob.deleteMany({ classroomId: { $in: classroomIds } }),
    LedgerEntry.deleteMany({ classroomId: { $in: classroomIds } }),
    Submission.deleteMany({ classroomId: { $in: classroomIds } }),
    Scenario.deleteMany({ classroomId: { $in: classroomIds } }),
    Store.deleteMany({ classroomId: { $in: classroomIds } }),
    Enrollment.deleteMany({ classroomId: { $in: classroomIds } }),
    VariableDefinition.deleteMany({ classroomId: { $in: classroomIds } }),
    ownerIdsForVariables.length > 0
      ? VariableValue.deleteMany({
          organization: organizationId,
          ownerId: { $in: ownerIdsForVariables },
        })
      : Promise.resolve(),
    Classroom.deleteMany({ _id: { $in: classroomIds } }),
  ]);

  // Finally delete seeded Members by clerkUserId prefix
  const prefix = `seed_demo_${seedTag.replace(/[^a-zA-Z0-9]/g, "_")}_`;
  await Member.deleteMany({ clerkUserId: { $regex: `^${prefix}` } });

  return { deleted: true, classrooms: classroomIds.length };
}

async function ensureVariableDefinitions({
  classroomId,
  organizationId,
  clerkUserId,
}) {
  const definitions = [
    // Store (4)
    {
      key: "startingBalance",
      label: "Starting Cash",
      description: "Initial cash balance when the store is created.",
      appliesTo: "store",
      dataType: "number",
      inputType: "number",
      min: 0,
      max: 250000,
      required: true,
      defaultValue: 50000,
    },
    {
      key: "startingInventory",
      label: "Starting Inventory",
      description: "Initial inventory balance when the store is created.",
      appliesTo: "store",
      dataType: "number",
      inputType: "number",
      min: 0,
      max: 100000,
      required: true,
      defaultValue: 1000,
    },
    {
      key: "maxDailyCapacity",
      label: "Max Daily Capacity",
      description: "Maximum pizzas per day the store can produce.",
      appliesTo: "store",
      dataType: "number",
      inputType: "number",
      min: 10,
      max: 1000,
      required: true,
      defaultValue: 120,
    },
    {
      key: "ingredientSource",
      label: "Ingredient Source",
      description: "Where key ingredients are sourced from.",
      appliesTo: "store",
      dataType: "select",
      inputType: "dropdown",
      // NOTE: VariableDefinition.validateValues expects options to be primitives
      // (it uses `options.includes(value)`), not {label,value} objects.
      options: [
        "local",
        "national_cost_effective",
        "international",
        "local_organic",
        "national_organic",
        "international_organic",
      ],
      required: true,
      defaultValue: "national_cost_effective",
    },

    // Scenario (4)
    {
      key: "expectedDemand",
      label: "Expected Demand",
      description: "Forecasted demand for the week (units).",
      appliesTo: "scenario",
      dataType: "number",
      inputType: "number",
      min: 0,
      max: 20000,
      required: true,
      defaultValue: 1200,
    },
    {
      key: "forecastedWeather",
      label: "Forecasted Weather",
      description: "Forecasted weather conditions for the week.",
      appliesTo: "scenario",
      dataType: "select",
      inputType: "dropdown",
      // NOTE: options must be primitive values (see validateValues)
      options: ["sunny", "cloudy", "rainy", "storm"],
      required: true,
      defaultValue: "cloudy",
    },
    {
      key: "specialEvent",
      label: "Special Event",
      description:
        "Optional special event affecting demand (e.g., campus game day).",
      appliesTo: "scenario",
      dataType: "string",
      inputType: "text",
      required: false,
      defaultValue: "",
    },
    {
      key: "expectedDemandMultiplier",
      label: "Expected Demand Multiplier",
      description:
        "Instructor-provided demand multiplier expectation (0.5–2.0).",
      appliesTo: "scenario",
      dataType: "number",
      inputType: "number",
      min: 0.5,
      max: 2,
      required: true,
      defaultValue: 1,
    },

    // Submission (4)
    {
      key: "plannedProduction",
      label: "Planned Production",
      description: "How many pizzas you plan to produce for the week.",
      appliesTo: "submission",
      dataType: "number",
      inputType: "number",
      min: 0,
      max: 50000,
      required: true,
      defaultValue: 1000,
    },
    {
      key: "staffingLevel",
      label: "Staffing Level",
      description: "How many staff-hours to schedule (abstracted).",
      appliesTo: "submission",
      dataType: "number",
      inputType: "number",
      min: 0,
      max: 1000,
      required: true,
      defaultValue: 40,
    },
    {
      key: "marketingSpend",
      label: "Marketing Spend",
      description: "Weekly marketing spend ($).",
      appliesTo: "submission",
      dataType: "number",
      inputType: "number",
      min: 0,
      max: 20000,
      required: true,
      defaultValue: 0,
    },
    {
      key: "inventoryOrder",
      label: "Inventory Order",
      description: "How many units of inventory you order for the week.",
      appliesTo: "submission",
      dataType: "number",
      inputType: "number",
      min: 0,
      max: 100000,
      required: true,
      defaultValue: 800,
    },
  ];

  // Create any missing definitions (idempotent)
  for (const def of definitions) {
    const exists = await VariableDefinition.findOne({
      classroomId,
      key: def.key,
    }).select("_id");
    if (exists) continue;
    await VariableDefinition.createDefinition(
      classroomId,
      def,
      organizationId,
      clerkUserId
    );
  }
}

async function createSeedMembersForClass({
  organizationId,
  seedTag,
  classroomIndex,
  studentsPerClassroom,
}) {
  const prefix = `seed_demo_${seedTag.replace(/[^a-zA-Z0-9]/g, "_")}_c${classroomIndex}_`;

  const toCreate = [];
  for (let i = 0; i < studentsPerClassroom; i++) {
    const clerkUserId = `${prefix}s${String(i).padStart(3, "0")}`;
    toCreate.push({
      clerkUserId,
      firstName: "Seed",
      lastName: `Student ${classroomIndex}-${i + 1}`,
      username: clerkUserId,
      publicMetadata: {},
      privateMetadata: {},
      unsafeMetadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      organizationMemberships: [
        {
          id: `seed_membership_${clerkUserId}`,
          organizationId,
          role: "org:member",
          publicMetadata: { isActive: true },
          organization: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
  }

  // Avoid duplicates on reruns (without --force)
  const ids = toCreate.map((d) => d.clerkUserId);
  const existing = await Member.find({ clerkUserId: { $in: ids } })
    .select("_id clerkUserId")
    .lean();
  const existingSet = new Set(existing.map((e) => e.clerkUserId));

  const missing = toCreate.filter((d) => !existingSet.has(d.clerkUserId));
  if (missing.length > 0) {
    await Member.insertMany(missing, { ordered: false });
  }

  // Return full list as docs (fresh query)
  return await Member.find({ clerkUserId: { $in: ids } })
    .select("_id clerkUserId")
    .lean();
}

function buildScenarioVariables(rng, week) {
  const expectedDemand = Math.round(900 + rng() * 900 + week * 30);
  const expectedDemandMultiplier = roundMoney(clamp(0.8 + rng() * 0.6, 0.5, 2));
  const weatherOptions = ["sunny", "cloudy", "rainy", "storm"];
  const forecastedWeather =
    weatherOptions[Math.floor(rng() * weatherOptions.length)];
  const specialEvent = rng() > 0.75 ? "Campus event (increased traffic)" : "";

  return {
    expectedDemand,
    expectedDemandMultiplier,
    forecastedWeather,
    specialEvent,
  };
}

function buildSubmissionVariables(rng, storePreset, scenarioVars) {
  const maxDailyCapacity = storePreset.maxDailyCapacity || 120;
  const maxWeeklyCapacity = Math.max(100, maxDailyCapacity * 7);

  const plannedProduction = Math.round(
    clamp(
      scenarioVars.expectedDemand * (0.85 + rng() * 0.4),
      0,
      maxWeeklyCapacity
    )
  );
  const staffingLevel = Math.round(clamp(30 + rng() * 80, 0, 1000));
  const marketingSpend = Math.round(clamp(rng() * 1200, 0, 20000));
  const inventoryOrder = Math.round(
    clamp(plannedProduction * (0.7 + rng() * 0.6), 0, 100000)
  );

  return { plannedProduction, staffingLevel, marketingSpend, inventoryOrder };
}

function computeLedgerFromVars({
  rng,
  cashBefore,
<<<<<<< HEAD
  inventoryState,
=======
  inventoryBefore,
>>>>>>> develop
  scenarioVars,
  submissionVars,
}) {
  const price = 14.0; // $ per pizza (demo)
  const unitCost = 6.25; // $ per pizza produced (demo)
  const wasteUnitCost = 1.0; // disposal / spoilage cost per unsold pizza (demo)
  const laborRate = 18.0; // $ per staff-hour (demo abstraction)

  const demandForecast = Math.round(
    scenarioVars.expectedDemand * scenarioVars.expectedDemandMultiplier
  );
  const demandActual = Math.round(demandForecast * (0.85 + rng() * 0.4));
  const sales = Math.max(
    0,
    Math.min(submissionVars.plannedProduction, demandActual)
  );
  const waste = Math.max(0, submissionVars.plannedProduction - sales);

  // Calculate stockouts/lost sales
  const stockoutUnits = Math.max(0, demandActual - sales);
  const lostSalesUnits = stockoutUnits; // For seed data, assume no backorders
  const backorderUnits = 0;

  // Service level metrics
  const serviceLevel = demandActual > 0 ? sales / demandActual : 1.0;
  const fillRate = serviceLevel; // Simplified for seed data

  const revenue = roundMoney(sales * price);

  // Cost breakdown
  const ingredientCost = roundMoney(
    submissionVars.plannedProduction * unitCost
  );
  const laborCost = roundMoney(submissionVars.staffingLevel * laborRate);
  const logisticsCost = roundMoney(submissionVars.inventoryOrder * 0.1); // 10% of order value
  const tariffCost = 0;
  // Calculate total inventory for holding cost
  const totalInventory =
    (inventoryState?.refrigeratedUnits || 0) +
    (inventoryState?.ambientUnits || 0) +
    (inventoryState?.notForResaleUnits || 0);
  const holdingCost = roundMoney(totalInventory * 0.02); // 2% of inventory value
  const overflowStorageCost = 0;
  const expediteCost = 0;
  const wasteDisposalCost = roundMoney(waste * wasteUnitCost);
  const otherCost = roundMoney(submissionVars.marketingSpend);

  const costs = roundMoney(
    ingredientCost +
      laborCost +
      logisticsCost +
      tariffCost +
      holdingCost +
      overflowStorageCost +
      expediteCost +
      wasteDisposalCost +
      otherCost
  );

  // Force exact continuity: cashAfter === cashBefore + netProfit (within cents)
  const cashAfter = roundMoney(cashBefore + (revenue - costs));
  const netProfit = roundMoney(cashAfter - cashBefore);

<<<<<<< HEAD
=======
  const inventoryAfter = Math.max(
    0,
    Math.round(
      inventoryBefore +
        submissionVars.inventoryOrder -
        submissionVars.plannedProduction
    )
  );

>>>>>>> develop
  // Material flow by bucket (simplified for seed data)
  // Assume refrigerated is used for production, ambient/notForResaleDry are mostly static
  const refrigeratedUsed = Math.round(sales * 0.5); // Rough estimate: 50% of sales uses refrigerated
  const refrigeratedWaste = Math.round(waste * 0.3); // 30% of waste is refrigerated
  const refrigeratedBegin = inventoryState?.refrigeratedUnits || 0;
  const refrigeratedReceived = Math.round(submissionVars.inventoryOrder * 0.5);
  const refrigeratedEnd = Math.max(
    0,
    refrigeratedBegin +
      refrigeratedReceived -
      refrigeratedUsed -
      refrigeratedWaste
  );

  const ambientBegin = inventoryState?.ambientUnits || 0;
  const ambientReceived = Math.round(submissionVars.inventoryOrder * 0.3);
  const ambientEnd = ambientBegin + ambientReceived; // Ambient doesn't get used in simplified model

<<<<<<< HEAD
  const notForResaleDryBegin = inventoryState?.notForResaleUnits || 0;
=======
  const notForResaleDryBegin = Math.round(inventoryBefore * 0.2);
>>>>>>> develop
  const notForResaleDryReceived = Math.round(
    submissionVars.inventoryOrder * 0.2
  );
  const notForResaleDryEnd = notForResaleDryBegin + notForResaleDryReceived; // Static inventory

  const inventoryStateAfter = {
    refrigeratedUnits: refrigeratedEnd,
    ambientUnits: ambientEnd,
    notForResaleUnits: notForResaleDryEnd,
  };

  // Teaching notes (brief summary)
  const teachingNotes =
    `Seeded simulation: ${sales} pizzas sold from ${submissionVars.plannedProduction} produced. ` +
    `Service level: ${(serviceLevel * 100).toFixed(1)}%. ` +
    `Net profit: $${netProfit.toFixed(2)}. ` +
    (stockoutUnits > 0 ? `${stockoutUnits} units lost due to stockout. ` : "") +
    (waste > 0 ? `${waste} units wasted. ` : "") +
    `Key factors: ${scenarioVars.forecastedWeather || "normal"} weather, ` +
    `${submissionVars.staffingLevel} staff-hours, $${submissionVars.marketingSpend} marketing spend.`;

  return {
    sales,
    revenue,
    costs,
    waste,
    netProfit,
    cashAfter,
    inventoryState: inventoryStateAfter,
    education: {
      demandForecast,
      demandActual,
      serviceLevel: roundMoney(serviceLevel),
      fillRate: roundMoney(fillRate),
      stockoutUnits,
      lostSalesUnits,
      backorderUnits,
      materialFlowByBucket: {
        refrigerated: {
          beginUnits: refrigeratedBegin,
          receivedUnits: refrigeratedReceived,
          usedUnits: refrigeratedUsed,
          wasteUnits: refrigeratedWaste,
          endUnits: refrigeratedEnd,
        },
        ambient: {
          beginUnits: ambientBegin,
          receivedUnits: ambientReceived,
          usedUnits: 0,
          wasteUnits: 0,
          endUnits: ambientEnd,
        },
        notForResaleDry: {
          beginUnits: notForResaleDryBegin,
          receivedUnits: notForResaleDryReceived,
          usedUnits: 0,
          wasteUnits: 0,
          endUnits: notForResaleDryEnd,
        },
      },
      costBreakdown: {
        ingredientCost,
        laborCost,
        logisticsCost,
        tariffCost,
        holdingCost,
        overflowStorageCost,
        expediteCost,
        wasteDisposalCost,
        otherCost,
      },
      teachingNotes,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);

  const mongoUrl = getMongoUrlFromEnv();
  if (!mongoUrl) {
    console.error(
      "Missing Mongo configuration. Set MONGO_URL/MONGO_URI or MONGO_SCHEME/MONGO_USERNAME/MONGO_PASSWORD/MONGO_HOSTNAME/MONGO_DB."
    );
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);

  const admin = await findTargetAdmin({ adminClerkUserId: args.admin });
  if (!admin) {
    console.log(
      "No admin found (requires at least one Member with org role 'org:admin'). Skipping seed."
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  const orgMembership = pickAdminOrgMembership(admin);
  if (!orgMembership?.organizationId) {
    console.error(
      "Admin does not have an organization membership with organizationId. Cannot seed."
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const organizationId = orgMembership.organizationId;
  const adminClerkUserId = admin.clerkUserId;
  const seedTag = buildSeedTag(adminClerkUserId, organizationId);

  // Prevent duplicates unless --force
  const existingSeedClasses = await Classroom.countDocuments({
    organization: organizationId,
    ownership: admin._id,
    description: seedTag,
  });

  if (existingSeedClasses > 0 && !args.force) {
    console.log(
      `Seed data already exists for this admin (${existingSeedClasses} classrooms). Re-run with --force to recreate.\nseedTag=${seedTag}`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  if (args.force && existingSeedClasses > 0) {
    if (!args.dryRun) {
      const del = await deleteSeedDataForAdmin({
        seedTag,
        organizationId,
        adminMemberId: admin._id,
      });
      console.log(
        `Deleted prior seed data: ${del.deleted ? "yes" : "no"} (classrooms=${del.classrooms})`
      );
    } else {
      console.log(
        `--dry-run: would delete prior seed data for seedTag=${seedTag}`
      );
    }
  }

  if (args.dryRun) {
    console.log(
      `--dry-run: would seed ${args.classrooms} classrooms x ${args.scenariosPerClassroom} scenarios x ${args.studentsPerClassroom} students for admin ${adminClerkUserId}\nseedTag=${seedTag}`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  const storeTypes = getAvailableStoreTypes();

  const created = {
    classrooms: 0,
    students: 0,
    stores: 0,
    scenarios: 0,
    submissions: 0,
    jobs: 0,
    ledgerEntries: 0,
    scenarioOutcomes: 0,
    variableDefinitions: 0, // best-effort (we don't count precisely)
  };

  for (let cIdx = 0; cIdx < args.classrooms; cIdx++) {
    const classroom = await Classroom.create({
      name: `SEED: Demo Classroom ${cIdx + 1}`,
      description: seedTag, // seed marker
      isActive: true,
      adminIds: [adminClerkUserId],
      ownership: admin._id,
      organization: organizationId,
      createdBy: adminClerkUserId,
      updatedBy: adminClerkUserId,
    });
    created.classrooms += 1;

    // Enroll admin as class admin
    await Enrollment.enrollUser(
      classroom._id,
      admin._id,
      "admin",
      organizationId,
      adminClerkUserId
    );

    // Variable definitions (idempotent)
    await ensureVariableDefinitions({
      classroomId: classroom._id,
      organizationId,
      clerkUserId: adminClerkUserId,
    });

    // Create scenarios BEFORE student enrollments to avoid scenario-created email jobs
    const scenarios = [];
    for (let sIdx = 0; sIdx < args.scenariosPerClassroom; sIdx++) {
      const rng = makeRng((cIdx + 1) * 1000 + (sIdx + 1) * 97);
      const scenarioVars = buildScenarioVariables(rng, sIdx + 1);
      const scenarioObj = await Scenario.createScenario(
        classroom._id,
        {
          title: `Week ${sIdx + 1}: Demand & Ops`,
          description: "Seeded scenario (completed).",
          variables: scenarioVars,
        },
        organizationId,
        adminClerkUserId
      );
      // IMPORTANT: Scenario.createScenario returns a plain object, but variables may not be
      // loaded yet because variablePopulationPlugin caches via async post-init.
      // Fetch through getScenarioById to ensure variables are loaded.
      const hydrated = await Scenario.getScenarioById(
        scenarioObj?._id || scenarioObj?.id,
        organizationId
      );
      scenarios.push(hydrated || scenarioObj);
      created.scenarios += 1;
    }

    // Create students (Members), enroll them, and create stores
    const students = await createSeedMembersForClass({
      organizationId,
      seedTag,
      classroomIndex: cIdx + 1,
      studentsPerClassroom: args.studentsPerClassroom,
    });

    created.students += students.length;

    // Track per-student economic state in-memory while seeding this class
    const studentState = new Map(); // memberId -> { clerkUserId, storeType, cash, inventoryState }

    for (let i = 0; i < students.length; i++) {
      const student = students[i];

      await Enrollment.enrollUser(
        classroom._id,
        student._id,
        "member",
        organizationId,
        adminClerkUserId
      );

      const storeType = storeTypes[i % storeTypes.length];
      const preset = getPreset(storeType);

      await Store.createStore(
        classroom._id,
        student._id,
        {
          shopName: `Seed Pizza ${cIdx + 1}-${i + 1}`,
          storeDescription: "Seeded store for demo / load testing.",
          storeLocation: "Demo City",
          storeType,
          variables: {}, // let presets + defaults populate
        },
        organizationId,
        adminClerkUserId
      );
      created.stores += 1;

      studentState.set(student._id.toString(), {
        clerkUserId: student.clerkUserId,
        storeType,
        cash: preset.startingBalance || 0,
        inventoryState: {
          refrigeratedUnits: preset.startingInventory || 0,
          ambientUnits: 0,
          notForResaleUnits: 0,
        },
      });
      created.ledgerEntries += 1; // initial ledger entry created by Store.createStore
    }

    // Complete each scenario: publish -> submissions -> outcome -> jobs+ledger -> close
    for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
      const scenarioId = scenarios[sIdx]._id || scenarios[sIdx].id;
      const scenarioDoc = await Scenario.findById(scenarioId);

      await scenarioDoc.publish(adminClerkUserId);

      // Outcome (required by worker; good to have for realism)
      await ScenarioOutcome.createOrUpdateOutcome(
        scenarioDoc._id,
        {
          notes: "Seeded outcome (completed).",
          randomEventChancePercent: 10,
        },
        organizationId,
        adminClerkUserId
      );
      created.scenarioOutcomes += 1;

      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        const stateKey = student._id.toString();
        const state = studentState.get(stateKey);
        const rng = makeRng(
          (cIdx + 1) * 100000 + (sIdx + 1) * 1000 + (i + 1) * 17
        );

        const preset = getPreset(state.storeType);
        // Always use a hydrated scenario variables map (avoid empty cached vars)
        const scenarioVars = scenarios[sIdx]?.variables
          ? scenarios[sIdx].variables
          : (await Scenario.getScenarioById(scenarioDoc._id, organizationId))
              ?.variables || {};
        const submissionVars = buildSubmissionVariables(
          rng,
          preset,
          scenarioVars
        );

        const submission = await Submission.createSubmission(
          classroom._id,
          scenarioDoc._id,
          student._id,
          submissionVars,
          organizationId,
          state.clerkUserId // pretend student submitted
        );
        created.submissions += 1;

        // Job (completed; do not enqueue Bull jobs)
        const job = await SimulationJob.createJob(
          {
            classroomId: classroom._id,
            scenarioId: scenarioDoc._id,
            submissionId: submission._id,
            userId: student._id,
            dryRun: false,
          },
          organizationId,
          adminClerkUserId
        );
        await job.markRunning();
        await job.markCompleted();
        created.jobs += 1;

        // Ledger entry
        const cashBefore = state.cash;
        const inventoryState = state.inventoryState || {
          refrigeratedUnits: 0,
          ambientUnits: 0,
          notForResaleUnits: 0,
        };
        const computed = computeLedgerFromVars({
          rng,
          cashBefore,
          inventoryState,
          scenarioVars,
          submissionVars,
        });

        const ledger = await LedgerEntry.createLedgerEntry(
          {
            classroomId: classroom._id,
            scenarioId: scenarioDoc._id,
            submissionId: submission._id,
            userId: student._id,
            sales: computed.sales,
            revenue: computed.revenue,
            costs: computed.costs,
            waste: computed.waste,
            cashBefore,
            cashAfter: computed.cashAfter,
            inventoryState: computed.inventoryState,
            netProfit: computed.netProfit,
            randomEvent: null,
            summary: "Seeded simulation result.",
            education: computed.education,
            aiMetadata: {
              model: "seed",
              runId: `seed:${classroom._id}:${scenarioDoc._id}:${student._id}`,
              generatedAt: new Date(),
            },
            calculationContext: {
              storeVariables: preset,
              scenarioVariables: scenarioVars,
              submissionVariables: submissionVars,
              outcomeVariables: {},
              priorState: {
                cashBefore,
                inventoryState,
                ledgerHistory: [],
              },
              prompt: null,
            },
          },
          organizationId,
          adminClerkUserId
        );
        created.ledgerEntries += 1;

        // Update submission pointers
        await Submission.updateOne(
          { _id: submission._id },
          {
            $set: { processingStatus: "completed", ledgerEntryId: ledger._id },
            $addToSet: { jobs: job._id },
          }
        );

        // Update in-memory state
        state.cash = computed.cashAfter;
        state.inventoryState = computed.inventoryState;
      }

      await scenarioDoc.close(adminClerkUserId);
    }
  }

  console.log("✅ Seed complete");
  console.log({
    seedTag,
    admin: adminClerkUserId,
    organizationId: organizationId.toString(),
    created,
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
