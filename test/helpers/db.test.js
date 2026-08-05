const test = require("node:test");
const assert = require("node:assert/strict");
const { setupTestDb, teardownTestDb, mongoose } = require("./db");

test("setupTestDb connects to in-memory MongoDB", async () => {
  await setupTestDb();
  assert.equal(mongoose.connection.readyState, 1);
  await teardownTestDb();
  assert.equal(mongoose.connection.readyState, 0);
});
