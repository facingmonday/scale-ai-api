#!/usr/bin/env node
/**
 * Seed submission variable definitions for all classrooms
 *
 * Creates the canonical set of 16 submission-level variable definitions
 * for every classroom in the database.
 *
 * Safety:
 * - Idempotent: skips variables that already exist (by key + classroomId)
 * - Can be run multiple times safely
 *
 * Usage:
 *   node scripts/seed-submission-variables.js
 *   node scripts/seed-submission-variables.js --dry-run
 *   npm run seed:submission-variables
 */
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config();
// Ensure models are registered
require(path.join(__dirname, "..", "models"));

const Classroom = require("../services/classroom/classroom.model");
const Member = require("../services/members/member.model");

function parseArgs(argv) {
  const args = {
    dryRun: false,
  };

  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw === "--help" || raw === "-h") {
      console.log(`\nSCALE.ai submission variables seed\n
Options:
  --dry-run              connect + validate, but do not write
  --help, -h             show this help message\n`);
      process.exit(0);
    }
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

/**
 * Get clerkUserId for a classroom
 * Tries adminIds first, then ownership member's clerkUserId
 */
async function getClerkUserIdForClassroom(classroom) {
  // Try adminIds first
  if (classroom.adminIds && classroom.adminIds.length > 0) {
    return classroom.adminIds[0];
  }

  // Fall back to ownership member's clerkUserId
  if (classroom.ownership) {
    const owner = await Member.findById(classroom.ownership)
      .select("clerkUserId")
      .lean();
    if (owner && owner.clerkUserId) {
      return owner.clerkUserId;
    }
  }

  // Last resort: use createdBy if available
  if (classroom.createdBy) {
    return classroom.createdBy;
  }

  throw new Error(
    `Cannot determine clerkUserId for classroom ${classroom._id}`
  );
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
  console.log("✅ Connected to MongoDB");

  // Get all classrooms
  const classrooms = await Classroom.find({}).lean();
  console.log(`📚 Found ${classrooms.length} classroom(s)`);

  if (classrooms.length === 0) {
    console.log("No classrooms found. Exiting.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const variableDefinitions =
    Classroom.getDefaultSubmissionVariableDefinitions();
  console.log(
    `📝 Will seed ${variableDefinitions.length} submission variable definitions per classroom`
  );

  if (args.dryRun) {
    console.log(
      "\n--dry-run: Would seed variables for the following classrooms:"
    );
    for (const classroom of classrooms) {
      console.log(`  - ${classroom.name} (${classroom._id})`);
    }
    await mongoose.disconnect();
    process.exit(0);
  }

  const stats = {
    classroomsProcessed: 0,
    variablesCreated: 0,
    variablesSkipped: 0,
    errors: 0,
  };

  for (const classroom of classrooms) {
    try {
      const classroomId = classroom._id;
      const organizationId = classroom.organization;

      if (!organizationId) {
        console.warn(
          `⚠️  Classroom ${classroom.name} (${classroomId}) missing organization. Skipping.`
        );
        stats.errors += 1;
        continue;
      }

      // Get clerkUserId for this classroom
      let clerkUserId;
      try {
        clerkUserId = await getClerkUserIdForClassroom(classroom);
      } catch (error) {
        console.warn(
          `⚠️  ${error.message}. Skipping classroom ${classroom.name} (${classroomId}).`
        );
        stats.errors += 1;
        continue;
      }

      console.log(`\n📖 Processing: ${classroom.name} (${classroomId})`);

      // Seed submission variables using the Classroom static method
      const seedStats = await Classroom.seedSubmissionVariables(
        classroomId,
        organizationId,
        clerkUserId
      );

      stats.variablesCreated += seedStats.created;
      stats.variablesSkipped += seedStats.skipped;
      stats.errors += seedStats.errors;

      if (seedStats.created > 0 || seedStats.skipped > 0) {
        console.log(
          `  ✅ Seeded variables: ${seedStats.created} created, ${seedStats.skipped} skipped`
        );
      }
      if (seedStats.errors > 0) {
        console.log(`  ⚠️  ${seedStats.errors} error(s) occurred`);
      }

      stats.classroomsProcessed += 1;
    } catch (error) {
      console.error(
        `❌ Error processing classroom ${classroom.name}: ${error.message}`
      );
      stats.errors += 1;
    }
  }

  console.log("\n✅ Seed complete");
  console.log({
    classroomsProcessed: stats.classroomsProcessed,
    variablesCreated: stats.variablesCreated,
    variablesSkipped: stats.variablesSkipped,
    errors: stats.errors,
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
