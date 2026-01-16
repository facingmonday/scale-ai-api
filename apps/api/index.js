// Load environment variables FIRST before any other imports that might use them
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { clerkMiddleware } = require("@clerk/express");
const { verifyRedisConnectivity } = require("../../lib/queues");
// Import all models before any other imports that might use them
require("../../models");

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

// Configure morgan logging FIRST, before any middleware that might send responses
// This ensures all requests are logged, even if middleware responds early
if (process.env.NODE_ENV === "production") {
  // In production, log only errors (status codes >= 400)
  // Note: This logs AFTER response is sent, so statusCode will be available
  app.use(
    morgan("combined", {
      skip: (req, res) => res.statusCode < 400,
      stream: process.stdout, // Explicitly write to stdout
    })
  );
} else {
  // In non-production environments, use tiny format for all requests
  app.use(
    morgan("tiny", {
      stream: process.stdout, // Explicitly write to stdout
    })
  );
}

// Initialize Clerk middleware with proper error handling
// Check if Clerk environment variables are set
if (!process.env.CLERK_SECRET_KEY) {
  console.warn("Warning: CLERK_SECRET_KEY not found in environment variables");
  console.warn("Clerk authentication will not work properly");
}

// Replace passport initialization with Clerk middleware
// Note: clerkMiddleware() should be called without arguments in newer versions
// The middleware will automatically read from environment variables
app.use(clerkMiddleware());

// Block GPTBot middleware
app.use((req, res, next) => {
  const userAgent = req.get("User-Agent") || "";
  if (userAgent.includes("GPTBot")) {
    return res.status(403).send("Access denied for GPTBot");
  }
  next();
});

// Serve robots.txt to block GPTBot
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send(`User-agent: GPTBot
Disallow: /

User-agent: *
Allow: /`);
});

// Webhooks moved to dedicated service in apps/webhooks

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PROD_CORS_ORIGINS = ["https://app.scalelxp.com"];
const DEV_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

// Optional: comma-separated list, e.g. "http://localhost:3001,https://staging.example.com"
const EXTRA_CORS_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV === "development";

// Defaults to strict production allowlist; expands in non-prod for local dev.
const ALLOWED_CORS_ORIGINS = new Set([
  ...PROD_CORS_ORIGINS,
  ...(isDev ? DEV_CORS_ORIGINS : []),
  ...EXTRA_CORS_ORIGINS,
]);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser / same-origin requests that don't send an Origin header
      if (!origin) return callback(null, true);

      if (ALLOWED_CORS_ORIGINS.has(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 204,
  })
);

// Return a clean 403 for disallowed CORS origins (instead of default 500)
app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS origin not allowed" });
  }
  next(err);
});

// Public join endpoint alias for backwards/contract compatibility.
// This mounts ONLY the join route at /api/join (without exposing the entire /v1 surface under /api).
app.use("/api/join", require("../../services/join"));

app.use("/v1", require("../../services"));

// Health check endpoints
const HealthChecker = require("../../lib/health-checks");
const healthChecker = new HealthChecker("api");
const healthMiddleware = healthChecker.createHealthCheckMiddleware();

// Expanded health endpoints
app.get("/health-check", healthMiddleware.basic);

// Start the server
console.log("Starting server on port ", process.env.PORT || 1337);
const PORT = process.env.PORT || 1337;

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

  // Ensure the global (developer-managed) classroom template exists.
  // This is safe to run on every startup (idempotent).
  try {
    const ClassroomTemplate = require("../../services/classroomTemplate/classroomTemplate.model");
    await ClassroomTemplate.ensureGlobalDefaultTemplate();

    // Ensure every organization has the default template copied locally.
    // This is safe to run on every startup (idempotent).
    const Organization = require("../../services/organizations/organization.model");
    const organizations = await Organization.find({}).select("_id").lean();
    const systemUserId = "system_startup";

    for (const org of organizations) {
      try {
        await ClassroomTemplate.copyGlobalToOrganization(org._id, systemUserId);
      } catch (e) {
        console.error(
          `⚠️  Failed ensuring default classroom template for org ${org._id}:`,
          e?.message || e
        );
      }
    }
  } catch (e) {
    console.error(
      "⚠️  Failed to ensure global ClassroomTemplate on startup:",
      e?.message || e
    );
  }

  const server = app.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
  );

  // Initialize email worker so emails can be processed from API service
  try {
    const { initEmailWorker } = require("../../lib/queues/email-worker");
    initEmailWorker();
    console.log("✅ Email worker initialized in API service");
  } catch (error) {
    console.error(
      "❌ Failed to initialize email worker in API service:",
      error.message
    );
    // Don't exit - API can still function without email processing
  }

  // Run Redis connectivity verification in the background and log outcome
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

  // Graceful shutdown handling
  const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    let shutdownTimeout;
    const forceExit = () => {
      console.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    };

    try {
      // Close HTTP server
      await new Promise((resolve, reject) => {
        shutdownTimeout = setTimeout(() => {
          reject(new Error("Server close timeout"));
        }, 8000);

        server.close((err) => {
          clearTimeout(shutdownTimeout);
          if (err) {
            reject(err);
          } else {
            console.log("HTTP server closed");
            resolve();
          }
        });
      });

      // Close MongoDB connection
      await mongoose.connection.close();
      console.log("MongoDB connection closed");

      console.log("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error.message);
      clearTimeout(shutdownTimeout);
      forceExit();
    }
  };

  // Handle different shutdown signals
  let isShuttingDown = false;
  const shutdownHandler = (signal) => {
    if (isShuttingDown) {
      console.log("Shutdown already in progress, forcing exit...");
      process.exit(1);
    }
    isShuttingDown = true;
    gracefulShutdown(signal).catch(() => {
      process.exit(1);
    });
  };

  process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
  process.on("SIGINT", () => shutdownHandler("SIGINT"));
  process.on("SIGUSR2", () => shutdownHandler("SIGUSR2")); // nodemon restart signal
}

main();
