const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { clerkMiddleware } = require("@clerk/express");
const { verifyRedisConnectivity } = require("../../lib/queues");

require("dotenv").config();
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

// Configure morgan logging based on environment
if (process.env.NODE_ENV === "production") {
  // In production, log only errors (status codes >= 400)
  app.use(
    morgan("combined", {
      skip: (req, res) => res.statusCode < 400,
    })
  );
} else {
  // In non-production environments, use tiny format for all requests
  app.use(morgan("tiny"));
}

// Webhooks moved to dedicated service in apps/webhooks

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

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

  // Seed store types and variable definitions for all existing organizations (runs once on startup)
  setTimeout(async () => {
    try {
      const Organization = require("../../services/organizations/organization.model");
      const StoreType = require("../../services/storeType/storeType.model");
      const VariableDefinition = require("../../services/variableDefinition/variableDefinition.model");

      const organizations = await Organization.find({});
      const systemUserId = "system_startup";

      let totalSeeded = 0;
      for (const org of organizations) {
        // Check if store types exist
        const storeTypes = await StoreType.getStoreTypesByOrganization(org._id);
        // Check if variable definitions exist (for storeType)
        const variableDefinitions =
          await VariableDefinition.getStoreTypeDefinitions(org._id);

        // Seed if either store types or variable definitions are missing
        if (storeTypes.length === 0 || variableDefinitions.length === 0) {
          const created = await StoreType.seedDefaultStoreTypes(
            org._id,
            systemUserId
          );
          totalSeeded += created.length;
          console.log(
            `Seeded ${created.length} store types for organization: ${org.name} (${org._id})`
          );
        }
      }

      if (totalSeeded > 0) {
        console.log(
          `✅ Seeded ${totalSeeded} store types across ${organizations.length} organizations`
        );
      } else {
        console.log(
          `✅ All organizations already have store types and variable definitions`
        );
      }
    } catch (seedError) {
      // Log but don't fail startup if seeding fails
      console.error(
        "⚠️  Error seeding store types on startup:",
        seedError.message
      );
    }
  }, 2000); // Wait 2 seconds after connection to ensure DB is ready

  const server = app.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
  );

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
