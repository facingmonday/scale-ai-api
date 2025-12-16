const mongoose = require("mongoose");

/**
 * Shared health check utilities for all Kikits services
 */
class HealthChecker {
  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  /**
   * Check MongoDB connection health
   */
  async checkMongoDB() {
    try {
      const state = mongoose.connection.readyState;
      const states = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
      };

      return {
        status: state === 1 ? "healthy" : "unhealthy",
        readyState: state,
        state: states[state] || "unknown",
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
      };
    } catch (error) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Check Redis connection health via Bull queues
   */
  async checkRedis() {
    try {
      // Import queues dynamically to avoid circular dependencies
      const { queues } = require("./queues");

      const redisStatus = {};
      let overallHealthy = true;

      for (const [name, queue] of Object.entries(queues)) {
        try {
          const startTime = Date.now();
          await queue.isReady();
          const responseTime = Date.now() - startTime;

          redisStatus[name] = {
            status: "healthy",
            responseTime: `${responseTime}ms`,
            connected: true,
          };
        } catch (error) {
          redisStatus[name] = {
            status: "unhealthy",
            error: error.message,
            connected: false,
          };
          overallHealthy = false;
        }
      }

      return {
        status: overallHealthy ? "healthy" : "unhealthy",
        queues: redisStatus,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get detailed queue statistics
   */
  async getQueueStats() {
    try {
      const { getQueueStats } = require("./queues");
      const stats = await getQueueStats();

      return {
        status: "healthy",
        queues: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Basic service health check
   */
  async basicHealthCheck() {
    const mongoStatus = await this.checkMongoDB();

    return {
      status: mongoStatus.status === "healthy" ? "healthy" : "unhealthy",
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      mongodb: mongoStatus,
    };
  }

  /**
   * Comprehensive health check with all services
   */
  async comprehensiveHealthCheck() {
    const [mongoStatus, redisStatus, queueStats] = await Promise.all([
      this.checkMongoDB(),
      this.checkRedis(),
      this.getQueueStats(),
    ]);

    const overallStatus =
      mongoStatus.status === "healthy" &&
      redisStatus.status === "healthy" &&
      queueStats.status === "healthy"
        ? "healthy"
        : "unhealthy";

    return {
      status: overallStatus,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      mongodb: mongoStatus,
      redis: redisStatus,
      queues: queueStats,
    };
  }

  /**
   * Create Express middleware for health check endpoints
   */
  createHealthCheckMiddleware() {
    return {
      // Basic health check
      basic: async (req, res) => {
        res.status(200).json({
          status: "OK",
          service: this.serviceName,
        });
      },

      // MongoDB health check
      mongodb: async (req, res) => {
        try {
          const mongoStatus = await this.checkMongoDB();
          const statusCode = mongoStatus.status === "healthy" ? 200 : 503;
          res.status(statusCode).json({
            service: this.serviceName,
            mongodb: mongoStatus,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          res.status(500).json({
            status: "error",
            service: this.serviceName,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      },

      // Redis health check
      redis: async (req, res) => {
        try {
          const redisStatus = await this.checkRedis();
          const statusCode = redisStatus.status === "healthy" ? 200 : 503;
          res.status(statusCode).json({
            service: this.serviceName,
            redis: redisStatus,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          res.status(500).json({
            status: "error",
            service: this.serviceName,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      },

      // Queue statistics
      queues: async (req, res) => {
        try {
          const queueStats = await this.getQueueStats();
          const statusCode = queueStats.status === "healthy" ? 200 : 503;
          res.status(statusCode).json({
            service: this.serviceName,
            queues: queueStats,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          res.status(500).json({
            status: "error",
            service: this.serviceName,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      },

      // Comprehensive health check
      comprehensive: async (req, res) => {
        try {
          const health = await this.comprehensiveHealthCheck();
          const statusCode = health.status === "healthy" ? 200 : 503;
          res.status(statusCode).json(health);
        } catch (error) {
          res.status(500).json({
            status: "error",
            service: this.serviceName,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      },
    };
  }
}

module.exports = HealthChecker;
