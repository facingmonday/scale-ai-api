/**
 * Test DB helpers — use mongodb-memory-server only (no localhost fallback).
 * Each test file should call setupTestDb() in before() and teardownTestDb() in after().
 */
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let memoryServer = null;

async function setupTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  await mongoose.connect(uri);
  return mongoose.connection;
}

async function teardownTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

async function clearCollections() {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}

function uniqueSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  uniqueSuffix,
  mongoose,
};
