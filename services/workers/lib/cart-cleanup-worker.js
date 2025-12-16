#!/usr/bin/env node

/**
 * Cart Cleanup Worker
 *
 * Runs periodically to expire abandoned carts.
 * Sets any cart with expiresAt < now to status "expired".
 */

require("dotenv").config();
const mongoose = require("mongoose");

// MongoDB connection configuration (only used in standalone mode)
const {
  MONGO_SCHEME,
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_HOSTNAME,
  MONGO_DB,
} = process.env;

const mongoUrl = `${MONGO_SCHEME}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DB}?authSource=admin`;

class CartCleanupWorker {
  constructor() {
    this.stats = {
      startTime: new Date(),
      scanned: 0,
      expired: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };
  }

  async connectDatabase() {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUrl);
      console.log("✅ Connected to MongoDB");
    }
  }

  async disconnectDatabase(force = false) {
    try {
      if (force && mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
        console.log("✅ Disconnected from MongoDB");
      }
    } catch (error) {
      console.error("❌ Failed to disconnect from MongoDB:", error.message);
    }
  }

  async processExpiredCarts() {
    try {
      const Cart = mongoose.model("Cart");

      const now = new Date();

      // Only target carts that are not completed/cancelled/expired/processing
      const query = {
        expiresAt: { $lt: now },
        status: { $in: ["active"] },
      };

      const toExpireCount = await Cart.countDocuments(query);
      this.stats.scanned = toExpireCount;

      if (toExpireCount === 0) {
        console.log("ℹ️  No carts to expire");
        return { success: true, expired: 0 };
      }

      const result = await Cart.updateMany(query, {
        $set: { status: "expired", updatedDate: new Date() },
      });

      this.stats.expired = result.modifiedCount || 0;
      console.log(`✅ Expired ${this.stats.expired} cart(s)`);
      return { success: true, expired: this.stats.expired };
    } catch (error) {
      console.error("❌ Error expiring carts:", error.message);
      this.stats.errors++;
      this.stats.errorDetails.push({ error: error.message });
      throw error;
    }
  }

  printSummary() {
    const endTime = new Date();
    const duration = Math.round((endTime - this.stats.startTime) / 1000);

    console.log("\n📊 CART CLEANUP WORKER SUMMARY");
    console.log("===============================");
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`🧹 Carts scanned: ${this.stats.scanned}`);
    console.log(`🧨 Carts expired: ${this.stats.expired}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
  }

  async run(standalone = true) {
    try {
      console.log("🚀 Starting Cart Cleanup Worker...");

      if (standalone) {
        await this.connectDatabase();
      }

      await this.processExpiredCarts();
      this.printSummary();

      if (standalone) {
        await this.disconnectDatabase(true);
      }

      return { success: this.stats.errors === 0, stats: this.stats };
    } catch (error) {
      console.error("💥 Cart cleanup worker failed:", error.message);
      if (standalone) {
        await this.disconnectDatabase(true);
        process.exit(1);
      }
      return { success: false, error: error.message, stats: this.stats };
    }
  }

  async runAsService() {
    try {
      await this.processExpiredCarts();
      return { success: true, stats: this.stats };
    } catch (error) {
      return { success: false, error: error.message, stats: this.stats };
    }
  }
}

module.exports = CartCleanupWorker;

if (require.main === module) {
  const worker = new CartCleanupWorker();
  worker
    .run(true)
    .then(() => {
      console.log("🎉 Worker finished successfully");
      process.exit(0);
    })
    .catch(() => process.exit(1));
}
