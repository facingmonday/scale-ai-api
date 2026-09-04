#!/usr/bin/env node
// Stop old workers before applying. This updates only missing configuration;
// it does not reset jobs, rerun results, or change an active batch.
require("../lib/load-local-env")();
const mongoose = require("mongoose");
const { ensureMongoConnected } = require("../lib/mongo-connection");

async function main() {
  await ensureMongoConnected();
  // Use the model's collection name rather than relying on a legacy alias.
  const Challenge = require("../services/challenge/challenge.model");
  const challenges = mongoose.connection.collection(Challenge.collection.name);
  const missingMode = { simulationMode: { $exists: false } };
  const missingConcurrency = { simulationConcurrency: { $exists: false } };
  const counts = {
    mode: await challenges.countDocuments(missingMode),
    concurrency: await challenges.countDocuments(missingConcurrency),
  };
  if (!process.argv.includes("--apply")) {
    console.log(
      "Dry run: legacy challenges needing processing settings",
      counts,
    );
    return;
  }
  await challenges.updateMany(missingMode, {
    $set: { simulationMode: "batch" },
  });
  await challenges.updateMany(missingConcurrency, {
    $set: { simulationConcurrency: 5 },
  });
  console.log("Backfilled legacy challenge settings", counts);
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Model loading also opens queue clients; close them before exiting.
    const { queues } = require("../lib/queues");
    await Promise.all(Object.values(queues).map((queue) => queue.close()));
    await mongoose.disconnect();
  });
