#!/usr/bin/env node

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
const moment = require("moment-timezone");
const cron = require("node-cron");
const { createBullBoard } = require("@bull-board/api");
const { BullAdapter } = require("@bull-board/api/bullAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const {
  queues,
  checkPendingJobs,
  verifyRedisConnectivity,
} = require("../../lib/queues");

// Load all models
require("../../models");

// Import worker helpers
const {
  stopAllScheduledJobs,
  scheduleJobsFromDB,
  ensureDefaultJobs,
  printSystemStatus,
  setupJobRefreshSchedule,
  initializeQueueWorkers,
  setupGracefulShutdown,
} = require("../../services/workers/workers.helpers");

// Environment variables
const {
  MONGO_SCHEME,
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_HOSTNAME,
  MONGO_DB,
  PORT_WORKERS = 1341,
  WORKERS_ENABLED = "true",
} = process.env;

const mongoUrl = `${MONGO_SCHEME}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DB}?authSource=admin`;

const app = express();

// Configure morgan logging based on environment
app.use(
  morgan("combined", {
    skip: (req, res) => res.statusCode < 400,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Bull Board setup for queue monitoring
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

const readOnlyMode = false; // process.env.NODE_ENV === "production"
console.log(
  `Starting Bull Board in ${readOnlyMode ? "read only" : "read write"} mode`
);
const pdfAdapter = new BullAdapter(queues.pdfGeneration, {
  readOnlyMode,
  allowRetries: !readOnlyMode,
  description: "PDF generation jobs",
});
const emailAdapter = new BullAdapter(queues.emailSending, {
  readOnlyMode,
  allowRetries: !readOnlyMode,
  description: "Email sending jobs",
});
const smsAdapter = new BullAdapter(queues.smsSending, {
  readOnlyMode,
  allowRetries: !readOnlyMode,
  description: "SMS sending jobs",
});
const pushAdapter = new BullAdapter(queues.pushSending, {
  readOnlyMode,
  allowRetries: !readOnlyMode,
  description: "Push sending jobs",
});

createBullBoard({
  queues: [pdfAdapter, emailAdapter, smsAdapter, pushAdapter],
  serverAdapter: serverAdapter,
  options: {
    uiConfig: {
      boardTitle: "Kikits Queues",
    },
  },
});

// Basic Auth (production only) for Bull Board
function bullBoardBasicAuth(req, res, next) {
  if (process.env.NODE_ENV !== "production") return next();

  const username = process.env.QUEUE_ADMIN_BASIC_AUTH_USER;
  const password = process.env.QUEUE_ADMIN_BASIC_AUTH_PASS;

  if (!username || !password) {
    return res
      .status(500)
      .send("Bull Board auth is not configured (missing credentials)");
  }

  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Queues"');
    return res.status(401).send("Authentication required.");
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64")
      .toString("utf8")
      .split(":");
    const [user, pass] = credentials;

    if (user === username && pass === password) {
      return next();
    }
  } catch (e) {
    // fallthrough to unauthorized
  }

  res.set("WWW-Authenticate", 'Basic realm="Queues"');
  return res.status(401).send("Access denied.");
}

app.use("/admin/queues", bullBoardBasicAuth, serverAdapter.getRouter());

// Scheduler state
const scheduledJobs = new Map();

// Make scheduledJobs available to the workers service
app.locals.scheduledJobs = scheduledJobs;

// Health check endpoints
const HealthChecker = require("../../lib/health-checks");
const healthChecker = new HealthChecker("workers");
const healthMiddleware = healthChecker.createHealthCheckMiddleware();

// Basic health check
app.get("/", healthMiddleware.basic);

// Use workers service routes
app.use("/", require("../../services/workers"));

async function main() {
  try {
    console.log("🚀 Starting Kikits Workers Service...");
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

    // Connect to MongoDB with retry logic
    const connectWithRetry = async () => {
      try {
        console.log(`📡 Connecting to MongoDB at ${MONGO_HOSTNAME}...`);
        await mongoose.connect(mongoUrl);
        console.log("✅ Connected to MongoDB");
      } catch (err) {
        console.error("❌ Failed to connect to MongoDB:", err.message);
        console.log("🔄 Retrying connection in 5 seconds...");
        setTimeout(connectWithRetry, 5000);
      }
    };

    await connectWithRetry();

    // Initialize scheduler
    if (WORKERS_ENABLED === "true") {
      await ensureDefaultJobs();
      await scheduleJobsFromDB(scheduledJobs);
      setupJobRefreshSchedule(scheduledJobs);

      console.log("✅ Scheduler initialized");
      const instanceId =
        process.env.INSTANCE_ID ||
        `${process.env.HOSTNAME || "host"}-${process.pid}`;
      console.log(`🆔 Instance: ${instanceId}`);
    } else {
      console.log(
        "ℹ️  Workers disabled via WORKERS_ENABLED environment variable"
      );
    }

    // Initialize queue workers
    initializeQueueWorkers();

    // Check for pending jobs after workers are initialized
    setTimeout(async () => {
      await checkPendingJobs();
    }, 1000);

    // Start the Express server ASAP so readiness probes can succeed
    const server = app.listen(PORT_WORKERS, () => {
      console.log(`🌐 Workers service listening on port ${PORT_WORKERS}`);
      console.log(`📊 Health check: http://localhost:${PORT_WORKERS}/`);
      console.log(
        `📋 Status endpoint: http://localhost:${PORT_WORKERS}/status`
      );
      console.log(
        `🔧 Registry endpoint: http://localhost:${PORT_WORKERS}/registry`
      );

      // Print system status after a short delay
      setTimeout(() => {
        printSystemStatus(scheduledJobs);
      }, 2000);
    });

    // Run Redis verification in the background (non-blocking)
    setTimeout(async () => {
      try {
        const redisCheck = await verifyRedisConnectivity();
        if (redisCheck.error) {
          console.error("🔴 Redis verification failed:", redisCheck);
        } else {
          console.log("🟢 Redis verification:", redisCheck);
        }
      } catch (e) {
        console.error("🔴 Redis verification threw error:", e.message || e);
      }
    }, 0);

    // Setup graceful shutdown handling
    setupGracefulShutdown(server, scheduledJobs);
  } catch (error) {
    console.error("💥 Workers service failed to start:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Unhandled error in main:", error.message);
    process.exit(1);
  });
}

module.exports = { main, app };
