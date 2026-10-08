#!/usr/bin/env node
const mongoose = require("mongoose");
const { getMongoUrl } = require("../lib/mongo-connection");
const { auditSeatCredits } = require("../services/licensing/seatCredit.audit");

async function main() {
  require("../lib/load-local-env")();
  await mongoose.connect(getMongoUrl(), {
    autoIndex: false,
    autoCreate: false,
  });
  try {
    const report = await auditSeatCredits(mongoose.connection);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Seat-credit audit failed:", error.message);
    process.exitCode = 1;
  });
}
