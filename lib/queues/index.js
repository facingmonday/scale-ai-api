const Queue = require("bull");
const Redis = require("redis");

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
};

// Determine if TLS should be used for Redis connections
const redisTlsEnabled =
  String(process.env.REDIS_TLS || "").toLowerCase() === "true" ||
  String(redisConfig.port) === "25061"; // Default DO Valkey TLS port
const redisTlsInsecure =
  String(process.env.REDIS_TLS_INSECURE || "").toLowerCase() === "true";

// Create Redis client for Bull
const redisOptions = {
  ...redisConfig,
  ...(redisTlsEnabled ? { tls: {} } : {}),
  // Bull specific options for better connection stability
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  // Additional options for better job recovery
  retryDelayOnFailover: 100,
  // Keep connection alive
  keepAlive: 30000,
  // Add connection retry logic
  retryDelayOnClusterDown: 300,
};

// Queue configurations
const QUEUE_NAMES = {
  PDF_GENERATION: "pdf-generation",
  EMAIL_SENDING: "email-sending",
  SMS_SENDING: "sms-sending",
  PUSH_SENDING: "push-sending",
};

// Create queues
const queues = {
  pdfGeneration: new Queue(QUEUE_NAMES.PDF_GENERATION, {
    redis: redisOptions,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  }),

  emailSending: new Queue(QUEUE_NAMES.EMAIL_SENDING, {
    redis: redisOptions,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  }),

  smsSending: new Queue(QUEUE_NAMES.SMS_SENDING, {
    redis: redisOptions,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 750,
      },
    },
  }),

  pushSending: new Queue(QUEUE_NAMES.PUSH_SENDING, {
    redis: redisOptions,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1500,
      },
    },
  }),
};

// Attach event listeners for better visibility into Redis/Bull state
for (const [name, queue] of Object.entries(queues)) {
  queue.on("ready", () => {
    console.log(`🟢 Queue ${name} is ready (Redis connected)`);
  });

  queue.on("error", (err) => {
    const message = (err && err.message) || String(err);
    console.error(`🔴 Queue ${name} error:`, message);
  });

  queue.on("stalled", (job) => {
    const id = job && job.id ? job.id : "unknown";
    console.warn(`⚠️  Queue ${name} stalled job: ${id}`);
  });

  queue.on("failed", (job, err) => {
    const id = job && job.id ? job.id : "unknown";
    const message = (err && err.message) || String(err);
    console.error(`❌ Queue ${name} job failed: ${id} - ${message}`);
  });
}

// Proactively check connectivity at startup (non-blocking)
(async () => {
  try {
    await Promise.all(
      Object.entries(queues).map(async ([name, q]) =>
        q
          .isReady()
          .then(() => console.log(`✅ Queue ${name} connection verified`))
          .catch((e) =>
            console.error(
              `🔴 Queue ${name} failed initial readiness check:`,
              (e && e.message) || String(e)
            )
          )
      )
    );
  } catch (_) {
    // individual errors already logged
  }
})();

// Queue statistics and monitoring
const getQueueStats = async () => {
  const stats = {};

  for (const [name, queue] of Object.entries(queues)) {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      stats[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total:
          waiting.length +
          active.length +
          completed.length +
          failed.length +
          delayed.length,
      };
    } catch (error) {
      console.error(`Error getting stats for queue ${name}:`, error.message);
      stats[name] = { error: error.message };
    }
  }

  return stats;
};

// Check for pending jobs on startup
const checkPendingJobs = async () => {
  console.log("🔍 Checking for pending jobs in queues...");

  for (const [name, queue] of Object.entries(queues)) {
    try {
      const [waiting, active, delayed, failed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getDelayed(),
        queue.getFailed(),
      ]);

      const totalPending = waiting.length + active.length + delayed.length;

      if (totalPending > 0) {
        console.log(
          `📋 Queue ${name}: ${waiting.length} waiting, ${active.length} active, ${delayed.length} delayed, ${failed.length} failed`
        );
      } else {
        console.log(`✅ Queue ${name}: No pending jobs`);
      }
    } catch (error) {
      console.error(`❌ Error checking queue ${name}:`, error.message);
    }
  }
};

// Graceful shutdown
const closeQueues = async () => {
  console.log("Closing Bull queues...");
  const promises = Object.values(queues).map((queue) => queue.close());
  await Promise.all(promises);
  console.log("All queues closed");
};

// Handle process termination
process.on("SIGTERM", closeQueues);
process.on("SIGINT", closeQueues);

/**
 * Ensure queue connection is ready, wait for reconnection if needed
 */
const ensureQueueReady = async (queue, queueName, timeoutMs = 5000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const client = queue.client;
      if (client && client.status === 'ready') {
        return true;
      }
      
      if (client && (client.status === 'close' || client.status === 'end')) {
        console.log(`🔄 Queue ${queueName} connection closed, waiting for reconnection...`);
      }
      
      await queue.isReady();
      return true;
    } catch (error) {
      if (Date.now() - startTime >= timeoutMs) {
        throw new Error(`Queue ${queueName} connection timeout: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  throw new Error(`Queue ${queueName} connection timeout after ${timeoutMs}ms`);
};

module.exports = {
  queues,
  QUEUE_NAMES,
  getQueueStats,
  checkPendingJobs,
  closeQueues,
  redisConfig,
  ensureQueueReady,
  /**
   * Verify Redis connectivity and basic operations, including XADD to a test stream
   */
  async verifyRedisConnectivity() {
    const client = Redis.createClient({
      socket: {
        host: redisConfig.host,
        port: Number(redisConfig.port),
        tls: redisTlsEnabled,
        ...(redisTlsInsecure ? { rejectUnauthorized: false } : {}),
      },
      password: redisConfig.password,
      database: Number(redisConfig.db),
    });

    const result = {
      ping: null,
      setGet: null,
      xadd: null,
      error: null,
    };

    try {
      const start = Date.now();
      await client.connect();

      // PING
      const pingRes = await client.ping();
      result.ping = {
        ok: pingRes === "PONG",
        response: pingRes,
        ms: Date.now() - start,
      };

      // SET/GET
      const testKey = `kikits:redis:selftest:${Date.now()}`;
      const testVal = `ok-${Math.random().toString(36).slice(2, 8)}`;
      await client.set(testKey, testVal, { EX: 10 });
      const got = await client.get(testKey);
      result.setGet = { ok: got === testVal, wrote: testVal, read: got };

      // XADD to test stream
      const stream = "kikits:selftest:stream";
      const id = await client.xAdd(stream, "*", {
        event: "startup",
        ts: String(Date.now()),
      });
      result.xadd = { ok: Boolean(id), id };

      await client.quit();
      return result;
    } catch (e) {
      result.error = e.message || String(e);
      try {
        await client.quit();
      } catch (_) {}
      return result;
    }
  },
};
