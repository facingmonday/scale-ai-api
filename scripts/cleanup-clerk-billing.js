#!/usr/bin/env node
/**
 * Remove legacy Clerk billing data from MongoDB.
 *
 * Clerk Commerce was never used in production; Stripe is the sole billing path.
 * This script drops the BillingSubscription collection and unsets billingSubscriptionId
 * on any SeatPool documents that still reference it.
 *
 * Usage:
 *   node scripts/cleanup-clerk-billing.js
 *   node scripts/cleanup-clerk-billing.js --dry-run
 *
 * Requirements:
 * - Mongo env set (same as apps/api):
 *   - MONGO_URL or MONGO_URI
 *   - OR MONGO_SCHEME/MONGO_USERNAME/MONGO_PASSWORD/MONGO_HOSTNAME/MONGO_DB
 */
const mongoose = require("mongoose");

require("../lib/load-local-env")();

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

function getMongoUri() {
  if (process.env.MONGO_URL) return process.env.MONGO_URL;
  if (process.env.MONGO_URI) return process.env.MONGO_URI;

  const {
    MONGO_SCHEME = "mongodb",
    MONGO_USERNAME,
    MONGO_PASSWORD,
    MONGO_HOSTNAME = "localhost:27017",
    MONGO_DB = "scale-ai",
  } = process.env;

  if (MONGO_USERNAME && MONGO_PASSWORD) {
    return `${MONGO_SCHEME}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DB}`;
  }

  return `${MONGO_SCHEME}://${MONGO_HOSTNAME}/${MONGO_DB}`;
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const uri = getMongoUri();

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const billingCount = await db
    .collection("billingsubscriptions")
    .countDocuments()
    .catch(() => 0);
  const seatPoolCount = await db
    .collection("seatpools")
    .countDocuments({ billingSubscriptionId: { $exists: true } })
    .catch(() => 0);

  console.log(`BillingSubscription documents: ${billingCount}`);
  console.log(`SeatPool documents with billingSubscriptionId: ${seatPoolCount}`);

  if (dryRun) {
    console.log("Dry run — no changes made.");
    await mongoose.disconnect();
    return;
  }

  if (billingCount > 0) {
    await db.collection("billingsubscriptions").drop();
    console.log("Dropped billingsubscriptions collection.");
  }

  if (seatPoolCount > 0) {
    const result = await db
      .collection("seatpools")
      .updateMany(
        { billingSubscriptionId: { $exists: true } },
        { $unset: { billingSubscriptionId: "" } }
      );
    console.log(`Unset billingSubscriptionId on ${result.modifiedCount} seat pool(s).`);
  }

  console.log("Cleanup complete.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
