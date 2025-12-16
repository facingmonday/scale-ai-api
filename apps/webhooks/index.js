const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");

require("dotenv").config();
// Load all models (Stripe webhook processing uses models)
require("../../models");

// Initialize queues (webhooks need to enqueue PDF/email/SMS jobs)
const { queues, verifyRedisConnectivity } = require("../../lib/queues");

const app = express();

// Global crash handlers to log unexpected errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

if (process.env.NODE_ENV === "production") {
  app.use(
    morgan("combined", {
      skip: (req, res) => res.statusCode < 400,
    })
  );
} else {
  app.use(morgan("tiny"));
}

// RAW body must come before any JSON parsing for webhooks
// We will attach raw body at router-level inside services/webhooks

// Health check endpoints
const HealthChecker = require("../../lib/health-checks");
const healthChecker = new HealthChecker("webhooks");
const healthMiddleware = healthChecker.createHealthCheckMiddleware();

// Basic health check
app.get("/", healthMiddleware.basic);

// Unified webhooks router (Clerk + Stripe)
app.use("/v1/webhooks", require("../../services/webhooks"));

const PORT = process.env.PORT_WEBHOOKS || 1340;

async function main() {
  const {
    MONGO_SCHEME,
    MONGO_USERNAME,
    MONGO_PASSWORD,
    MONGO_HOSTNAME,
    MONGO_DB,
  } = process.env;

  const url = `${MONGO_SCHEME}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DB}?authSource=admin`;

  const connectWithRetry = async () => {
    try {
      console.log(`Connecting to MongoDB at ${MONGO_HOSTNAME}`);
      await mongoose.connect(url);
    } catch (err) {
      console.error("Failed to connect to MongoDB: ", err);
      setTimeout(connectWithRetry, 5000);
    }
  };

  await connectWithRetry();

  // Verify Redis connectivity (non-blocking)
  setTimeout(async () => {
    try {
      console.log("🔍 Verifying Redis connectivity...");
      const redisCheck = await verifyRedisConnectivity();
      if (redisCheck.error) {
        console.error("🔴 Redis verification failed:", redisCheck);
        console.warn("⚠️  Queue operations may fail until Redis is available");
      } else {
        console.log("✅ Redis connectivity verified");
      }
    } catch (e) {
      console.error("🔴 Redis verification error:", e.message);
    }
  }, 1000);

  app.listen(PORT, () => {
    console.log(`Webhooks service on ${PORT}`);
    console.log("✅ Queues initialized and ready");
  });
}

main();
