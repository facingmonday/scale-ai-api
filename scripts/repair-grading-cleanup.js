#!/usr/bin/env node
// Read-only unless --apply is passed. Never modifies source classroom data.
require("../lib/load-local-env")();
const mongoose = require("mongoose");
const { ensureMongoConnected } = require("../lib/mongo-connection");

async function main() {
  const orgIndex = process.argv.indexOf("--organization");
  const organizationId = orgIndex < 0 ? null : process.argv[orgIndex + 1];
  if (!mongoose.isObjectIdOrHexString(organizationId))
    throw new Error(
      "Usage: node scripts/repair-grading-cleanup.js --organization OBJECT_ID [--apply]",
    );
  await ensureMongoConnected();
  const Classroom = require("../services/classroom/classroom.model");
  const Challenge = require("../services/challenge/challenge.model");
  const {
    GradeAdjustment,
    GradeExclusion,
  } = require("../services/grading/grading.model");
  const organization = new mongoose.Types.ObjectId(organizationId);
  for (const Model of [GradeAdjustment, GradeExclusion]) {
    let found = 0;
    const cursor = Model.find({ organization })
      .select("classroomId challengeId")
      .lean()
      .cursor({ batchSize: 100 });
    let batch = [];
    async function processBatch() {
      if (!batch.length) return;
      const classrooms = await Classroom.collection
        .find(
          { organization, _id: { $in: batch.map((r) => r.classroomId) } },
          { projection: { _id: 1 }, maxTimeMS: 5000 },
        )
        .toArray();
      const challenges = await Challenge.collection
        .find(
          { organization, _id: { $in: batch.map((r) => r.challengeId) } },
          { projection: { _id: 1, classroomId: 1 }, maxTimeMS: 5000 },
        )
        .toArray();
      const classroomIds = new Set(classrooms.map((c) => String(c._id)));
      const pairs = new Set(challenges.map((c) => `${c.classroomId}:${c._id}`));
      const orphans = batch.filter(
        (r) =>
          !classroomIds.has(String(r.classroomId)) ||
          !pairs.has(`${r.classroomId}:${r.challengeId}`),
      );
      found += orphans.length;
      if (process.argv.includes("--apply") && orphans.length)
        await Model.deleteMany({
          organization,
          _id: { $in: orphans.map((r) => r._id) },
        }).maxTimeMS(5000);
      batch = [];
    }
    for await (const record of cursor) {
      batch.push(record);
      if (batch.length === 100) await processBatch();
    }
    await processBatch();
    console.log({
      collection: Model.collection.name,
      orphanedRecords: found,
      applied: process.argv.includes("--apply"),
    });
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
    // Application model imports may open queue clients.
    const queuesModule = require.cache[require.resolve("../lib/queues")];
    if (queuesModule)
      await Promise.all(
        Object.values(queuesModule.exports.queues || {}).map((queue) =>
          queue.close(),
        ),
      );
  });
