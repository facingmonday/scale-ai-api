const test = require("node:test");
const assert = require("node:assert/strict");
const { getMongoUrl } = require("../../lib/mongo-connection");

test("getMongoUrl prefers a direct connection string", () => {
  assert.equal(
    getMongoUrl({
      MONGO_URL: "mongodb://direct.example/test",
      MONGO_HOSTNAME: "ignored.example",
      MONGO_DB: "ignored",
    }),
    "mongodb://direct.example/test",
  );
});

test("getMongoUrl supports the split worker environment configuration", () => {
  assert.equal(
    getMongoUrl({
      MONGO_SCHEME: "mongodb",
      MONGO_USERNAME: "worker@example.com",
      MONGO_PASSWORD: "p@ss:word",
      MONGO_HOSTNAME: "localhost:27017",
      MONGO_DB: "scale lxp",
    }),
    "mongodb://worker%40example.com:p%40ss%3Aword@localhost:27017/scale%20lxp?authSource=admin",
  );
});

test("getMongoUrl reports incomplete configuration before connecting", () => {
  assert.throws(
    () => getMongoUrl({ MONGO_HOSTNAME: "localhost:27017" }),
    /MONGO_DB/,
  );
});
