const mongoose = require("mongoose");

function getMongoUrl(env = process.env) {
  const directUrl = env.MONGO_URL || env.MONGO_URI;
  if (directUrl) return directUrl;

  const {
    MONGO_SCHEME = "mongodb",
    MONGO_USERNAME,
    MONGO_PASSWORD,
    MONGO_HOSTNAME,
    MONGO_DB,
  } = env;

  const missing = [];
  if (!MONGO_HOSTNAME) missing.push("MONGO_HOSTNAME");
  if (!MONGO_DB) missing.push("MONGO_DB");
  if (
    (MONGO_USERNAME && !MONGO_PASSWORD) ||
    (!MONGO_USERNAME && MONGO_PASSWORD)
  ) {
    missing.push(MONGO_USERNAME ? "MONGO_PASSWORD" : "MONGO_USERNAME");
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing MongoDB configuration: ${missing.join(", ")}. Set MONGO_URL/MONGO_URI or the split MONGO_* variables.`,
    );
  }

  const credentials = MONGO_USERNAME
    ? `${encodeURIComponent(MONGO_USERNAME)}:${encodeURIComponent(MONGO_PASSWORD)}@`
    : "";
  const authSource = credentials ? "?authSource=admin" : "";
  return `${MONGO_SCHEME}://${credentials}${MONGO_HOSTNAME}/${encodeURIComponent(MONGO_DB)}${authSource}`;
}

let connectionPromise = null;

async function ensureMongoConnected() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  if (mongoose.connection.readyState === 2) {
    connectionPromise = mongoose.connection.asPromise();
  } else {
    connectionPromise = mongoose.connect(getMongoUrl());
  }

  try {
    await connectionPromise;
    return mongoose.connection;
  } finally {
    connectionPromise = null;
  }
}

module.exports = { getMongoUrl, ensureMongoConnected };
