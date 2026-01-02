#!/usr/bin/env node
/**
 * Seed StoreTypes + org-scoped storeType VariableDefinitions + VariableValues from STORE_TYPE_PRESETS.
 *
 * Creates:
 * - One StoreType per key in services/store/storeTypePresets.js STORE_TYPE_PRESETS
 * - A curated set of VariableDefinitions (appliesTo="storeType", classroomId=null)
 * - VariableValues for each StoreType for each of those definitions
 *
 * Usage:
 *   node scripts/seed-store-types-from-presets.js --org=<mongoOrgId> --clerk=user_xxx
 *   node scripts/seed-store-types-from-presets.js --org=<mongoOrgId> --dry-run
 */

const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config();
require(path.join(__dirname, "..", "models"));

const StoreType = require("../services/storeType/storeType.model");
const VariableDefinition = require("../services/variableDefinition/variableDefinition.model");
const VariableValue = require("../services/variableDefinition/variableValue.model");

const { STORE_TYPE_PRESETS } = require("../services/store/storeTypePresets");

function parseArgs(argv) {
  const args = {
    organizationId: null,
    clerkUserId: "system_seed",
    dryRun: false,
  };
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw.startsWith("--org="))
      args.organizationId = raw.split("=").slice(1).join("=");
    else if (raw.startsWith("--clerk="))
      args.clerkUserId = raw.split("=").slice(1).join("=");
    else if (raw === "--help" || raw === "-h") {
      console.log(`\nSCALE.ai storeType seeding\n
Options:
  --org=<mongoOrgId>      required (Organization _id in Mongo)
  --clerk=<clerkUserId>   createdBy/updatedBy (default: system_seed)
  --dry-run               connect + plan, but do not write\n`);
      process.exit(0);
    }
  }
  if (!args.organizationId) {
    throw new Error("--org=<mongoOrgId> is required");
  }
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

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function collectOptionsFromPresets(field) {
  const vals = Object.values(STORE_TYPE_PRESETS).map((p) => p[field]);
  return uniq(vals.map((v) => (typeof v === "string" ? v.trim() : v))).filter(
    (v) => typeof v === "string" && v.length > 0
  );
}

function collectCommonIssuesOptions() {
  const all = [];
  Object.values(STORE_TYPE_PRESETS).forEach((p) => {
    if (Array.isArray(p.commonIssues)) all.push(...p.commonIssues);
  });
  return uniq(all.map((s) => String(s).trim())).filter((s) => s.length > 0);
}

function normalizeStartingInventoryBuckets(preset) {
  const inv = preset?.startingInventory;
  if (typeof inv === "number") {
    return {
      refrigeratedUnits: Number(inv) || 0,
      ambientUnits: 0,
      notForResaleUnits: 0,
    };
  }
  if (inv && typeof inv === "object" && !Array.isArray(inv)) {
    return {
      refrigeratedUnits: Number(inv.refrigeratedUnits) || 0,
      ambientUnits: Number(inv.ambientUnits) || 0,
      notForResaleUnits: Number(inv.notForResaleUnits) || 0,
    };
  }
  // fallback
  return { refrigeratedUnits: 0, ambientUnits: 0, notForResaleUnits: 0 };
}

function buildStoreTypeVariableDefinitions() {
  const weatherOptions = collectOptionsFromPresets("weatherSensitivity");
  const mobilityOptions = collectOptionsFromPresets("mobility");
  const riskProfileOptions = collectOptionsFromPresets("riskProfile");
  const commonIssuesOptions = collectCommonIssuesOptions();

  return [
    {
      key: "startingBalance",
      label: "Starting Balance",
      description: "Initial cash available when the store starts.",
      appliesTo: "storeType",
      dataType: "number",
      inputType: "number",
      defaultValue: 50000,
      min: 0,
      max: 200000,
      required: true,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "initialStartupCost",
      label: "Initial Startup Cost",
      description:
        "One-time cost to set up the store type (capex/launch cost).",
      appliesTo: "storeType",
      dataType: "number",
      inputType: "number",
      defaultValue: 0,
      min: 0,
      max: 200000,
      required: false,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "startingInventoryRefrigeratedUnits",
      label: "Starting Inventory (Refrigerated Units)",
      description:
        "Initial refrigerated inventory units available at the start of the simulation.",
      appliesTo: "storeType",
      dataType: "number",
      inputType: "number",
      defaultValue: 500,
      min: 0,
      max: 20000,
      required: true,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "startingInventoryAmbientUnits",
      label: "Starting Inventory (Ambient Units)",
      description:
        "Initial ambient/dry inventory units available at the start of the simulation.",
      appliesTo: "storeType",
      dataType: "number",
      inputType: "number",
      defaultValue: 300,
      min: 0,
      max: 20000,
      required: true,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "startingInventoryNotForResaleUnits",
      label: "Starting Inventory (Not-for-Resale Units)",
      description:
        "Initial not-for-resale dry goods units (packaging/cleaning) available at the start of the simulation.",
      appliesTo: "storeType",
      dataType: "number",
      inputType: "number",
      defaultValue: 200,
      min: 0,
      max: 20000,
      required: true,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "maxDailyCapacity",
      label: "Max Daily Capacity",
      description:
        "Maximum units the store can produce/sell per day (capacity cap).",
      appliesTo: "storeType",
      dataType: "number",
      inputType: "number",
      defaultValue: 100,
      min: 0,
      max: 1000,
      required: true,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "staffRequired",
      label: "Staff Required",
      description:
        "Typical staffing level required to operate this store type.",
      appliesTo: "storeType",
      dataType: "number",
      inputType: "number",
      defaultValue: 2,
      min: 0,
      max: 50,
      required: true,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "weatherSensitivity",
      label: "Weather Sensitivity",
      description:
        "How strongly demand/operations are impacted by weather conditions for this store type.",
      appliesTo: "storeType",
      dataType: "select",
      inputType: "dropdown",
      options: weatherOptions,
      defaultValue: weatherOptions.includes("medium")
        ? "medium"
        : weatherOptions[0] || "medium",
      required: true,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "mobility",
      label: "Mobility",
      description:
        "How easily the store can change locations (affects ability to chase demand).",
      appliesTo: "storeType",
      dataType: "select",
      inputType: "dropdown",
      options: mobilityOptions,
      defaultValue: mobilityOptions.includes("none")
        ? "none"
        : mobilityOptions[0] || "none",
      required: true,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "riskProfile",
      label: "Risk Profile",
      description:
        "Overall operational/financial risk posture implied by this store type.",
      appliesTo: "storeType",
      dataType: "select",
      inputType: "dropdown",
      options: riskProfileOptions,
      defaultValue: riskProfileOptions.includes("balanced")
        ? "balanced"
        : riskProfileOptions[0] || "balanced",
      required: true,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "commonIssues",
      label: "Common Issues",
      description:
        "Typical operational issues this store type faces (stored as an array of strings).",
      appliesTo: "storeType",
      dataType: "string",
      inputType: "text",
      options: commonIssuesOptions,
      defaultValue: [],
      required: false,
      affectsCalculation: true,
      isActive: true,
    },
    {
      key: "pros",
      label: "Pros",
      description: "Short explanation of advantages of this store type.",
      appliesTo: "storeType",
      dataType: "string",
      inputType: "text",
      defaultValue: "",
      required: false,
      affectsCalculation: false,
      isActive: true,
    },
    {
      key: "cons",
      label: "Cons",
      description: "Short explanation of disadvantages of this store type.",
      appliesTo: "storeType",
      dataType: "string",
      inputType: "text",
      defaultValue: "",
      required: false,
      affectsCalculation: false,
      isActive: true,
    },
  ];
}

async function upsertStoreTypeDefinition(
  def,
  organizationId,
  clerkUserId,
  dryRun
) {
  // Defensive check: some older DBs may still have a legacy unique index on (classroomId, key)
  // that does NOT include appliesTo. If a conflicting definition exists for the same org/key,
  // don't attempt to insert; just warn and continue.
  const anyExistingSameKey = await VariableDefinition.findOne({
    organization: organizationId,
    classroomId: null,
    key: def.key,
  });
  if (anyExistingSameKey && anyExistingSameKey.appliesTo !== "storeType") {
    console.warn(
      `⚠️  Skipping storeType VariableDefinition "${def.key}" because a different definition already exists for classroomId=null with appliesTo="${anyExistingSameKey.appliesTo}".`
    );
    return { action: "skip", key: def.key };
  }

  const existing = await VariableDefinition.findOne({
    organization: organizationId,
    classroomId: null,
    appliesTo: "storeType",
    key: def.key,
  });

  if (existing) {
    // Keep idempotent: update metadata if it changed (best-effort)
    if (dryRun) return { action: "skip", key: def.key };
    existing.label = def.label;
    existing.description = def.description || "";
    existing.dataType = def.dataType;
    existing.inputType = def.inputType || existing.inputType;
    existing.options = def.options || [];
    existing.defaultValue =
      def.defaultValue !== undefined ? def.defaultValue : existing.defaultValue;
    existing.min = def.min !== undefined ? def.min : existing.min;
    existing.max = def.max !== undefined ? def.max : existing.max;
    existing.required =
      def.required !== undefined ? def.required : existing.required;
    existing.affectsCalculation =
      def.affectsCalculation !== undefined
        ? def.affectsCalculation
        : existing.affectsCalculation;
    existing.isActive = true;
    existing.updatedBy = clerkUserId;
    await existing.save();
    return { action: "updated", key: def.key };
  }

  if (dryRun) return { action: "create", key: def.key };

  try {
    await VariableDefinition.createDefinition(
      null,
      def,
      organizationId,
      clerkUserId
    );
    return { action: "created", key: def.key };
  } catch (e) {
    const msg = e?.message || String(e);
    // Do not fail the whole seed on duplicate key errors; log + continue.
    if (msg.includes("E11000") || msg.includes("duplicate key")) {
      console.warn(
        `⚠️  Duplicate VariableDefinition for "${def.key}" (skipping).`
      );
      return { action: "skip", key: def.key };
    }
    console.warn(
      `⚠️  Failed to create VariableDefinition "${def.key}" (skipping): ${msg}`
    );
    return { action: "skip", key: def.key };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const mongoUrl = getMongoUrlFromEnv();
  if (!mongoUrl) {
    throw new Error(
      "Missing Mongo configuration. Set MONGO_URL/MONGO_URI or MONGO_SCHEME/MONGO_USERNAME/MONGO_PASSWORD/MONGO_HOSTNAME/MONGO_DB."
    );
  }

  await mongoose.connect(mongoUrl);
  console.log("✅ Connected to MongoDB");

  const organizationId = args.organizationId;
  const clerkUserId = args.clerkUserId;

  const presetKeys = Object.keys(STORE_TYPE_PRESETS);
  console.log(`📦 Found ${presetKeys.length} storeType preset(s)`);

  // 1) Ensure VariableDefinitions exist (org-scoped, appliesTo=storeType)
  const defs = buildStoreTypeVariableDefinitions();
  const defStats = { created: 0, updated: 0, skipped: 0 };
  for (const def of defs) {
    const res = await upsertStoreTypeDefinition(
      def,
      organizationId,
      clerkUserId,
      args.dryRun
    );
    if (res.action === "created") defStats.created += 1;
    else if (res.action === "updated") defStats.updated += 1;
    else defStats.skipped += 1;
  }
  console.log("🧩 VariableDefinitions:", defStats);

  // 2) Create StoreTypes + assign VariableValues
  const stats = {
    storeTypesCreated: 0,
    storeTypesExisting: 0,
    valuesUpserted: 0,
  };

  for (const key of presetKeys) {
    try {
      const preset = STORE_TYPE_PRESETS[key];
      const label = preset.label || key;
      const description = preset.description || "";

      let storeTypeDoc = await StoreType.findOne({
        organization: organizationId,
        key,
      });

      if (!storeTypeDoc) {
        if (!args.dryRun) {
          storeTypeDoc = new StoreType({
            organization: organizationId,
            key,
            label,
            description,
            isActive: true,
            createdBy: clerkUserId,
            updatedBy: clerkUserId,
          });
          await storeTypeDoc.save();
        }
        stats.storeTypesCreated += 1;
      } else {
        stats.storeTypesExisting += 1;
        if (!args.dryRun) {
          // Best-effort keep label/description in sync
          storeTypeDoc.label = label;
          storeTypeDoc.description = description;
          storeTypeDoc.isActive = true;
          storeTypeDoc.updatedBy = clerkUserId;
          await storeTypeDoc.save();
        }
      }

      if (args.dryRun) continue;

      const inv = normalizeStartingInventoryBuckets(preset);

      const valueMap = {
        startingBalance: preset.startingBalance ?? 0,
        initialStartupCost: preset.initialStartupCost ?? 0,
        startingInventoryRefrigeratedUnits: inv.refrigeratedUnits,
        startingInventoryAmbientUnits: inv.ambientUnits,
        startingInventoryNotForResaleUnits: inv.notForResaleUnits,
        maxDailyCapacity: preset.maxDailyCapacity ?? 0,
        staffRequired: preset.staffRequired ?? 0,
        weatherSensitivity: preset.weatherSensitivity ?? "medium",
        mobility: preset.mobility ?? "none",
        riskProfile: preset.riskProfile ?? "balanced",
        commonIssues: Array.isArray(preset.commonIssues)
          ? preset.commonIssues
          : [],
        pros: preset.pros ?? "",
        cons: preset.cons ?? "",
      };

      for (const [variableKey, value] of Object.entries(valueMap)) {
        try {
          await VariableValue.setVariable(
            "storeType",
            storeTypeDoc._id,
            variableKey,
            value,
            organizationId,
            clerkUserId
          );
          stats.valuesUpserted += 1;
        } catch (e) {
          console.warn(
            `⚠️  Failed to set VariableValue "${variableKey}" for storeType "${key}" (skipping): ${e?.message || String(e)}`
          );
        }
      }
    } catch (e) {
      console.warn(
        `⚠️  Failed processing storeType "${key}" (skipping): ${e?.message || String(e)}`
      );
    }
  }

  console.log("✅ Seed complete", stats);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
