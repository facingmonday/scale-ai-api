#!/usr/bin/env node

/**
 * Ticket Reminder Worker
 *
 * This worker runs daily at 10am CST to send reminder emails
 * to ticket holders for events happening tomorrow.
 *
 * Features:
 * - Fetches member emails from Clerk API with throttling to avoid rate limits
 * - Automatic retry logic for failed Clerk API calls
 * - Processes only completed orders with generated tickets
 * - Rate limiting: 1 second delay between Clerk API calls
 * - Max 3 retry attempts per member email fetch
 *
 * Usage:
 *   node workers/lib/ticket-reminder-worker.js
 *
 * Cron setup (10am CST daily):
 *   0 10 * * * cd /path/to/kikits-api && node workers/lib/ticket-reminder-worker.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const moment = require("moment-timezone");

require("../../../models");

const OrderModel = require("../../../services/order/order.model");

// MongoDB connection configuration
const {
  MONGO_SCHEME,
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_HOSTNAME,
  MONGO_DB,
} = process.env;

const mongoUrl = `${MONGO_SCHEME}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DB}?authSource=admin`;

// Set timezone for CST
const TIMEZONE = "America/Chicago";

class TicketReminderWorker {
  constructor() {
    this.stats = {
      startTime: new Date(),
      ordersProcessed: 0,
      remindersSent: 0,
      remindersSkipped: 0,
      errors: 0,
      errorDetails: [],
    };

    // Throttling configuration for Clerk API calls
    this.clerkThrottle = {
      queue: [],
      processing: false,
      rateLimitDelay: 1000, // 1 second between calls to avoid rate limiting
      maxRetries: 3,
      retryDelay: 2000, // 2 seconds between retries
    };
  }

  /**
   * Throttled email fetching from Clerk to avoid rate limiting
   */
  async getEmailFromClerkThrottled(member) {
    return new Promise((resolve, reject) => {
      this.clerkThrottle.queue.push({
        member,
        resolve,
        reject,
        retries: 0,
      });

      // Start processing if not already running
      if (!this.clerkThrottle.processing) {
        this.processClerkQueue();
      }
    });
  }

  /**
   * Process the Clerk API queue with throttling
   */
  async processClerkQueue() {
    if (
      this.clerkThrottle.processing ||
      this.clerkThrottle.queue.length === 0
    ) {
      return;
    }

    this.clerkThrottle.processing = true;

    while (this.clerkThrottle.queue.length > 0) {
      const request = this.clerkThrottle.queue.shift();
      const { member, resolve, reject, retries } = request;

      try {
        console.log(
          `📧 Fetching email from Clerk for member ${member._id} (attempt ${
            retries + 1
          })`
        );

        // Use the member's built-in method to get email from Clerk
        const email = await member.getEmailFromClerk();

        if (!email || !this.isValidEmail(email)) {
          throw new Error(`Invalid email received from Clerk: ${email}`);
        }

        console.log(`✅ Successfully fetched email for member ${member._id}`);
        resolve(email);

        // Add delay between requests to respect rate limits
        if (this.clerkThrottle.queue.length > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.clerkThrottle.rateLimitDelay)
          );
        }
      } catch (error) {
        console.error(
          `❌ Error fetching email from Clerk for member ${member._id}:`,
          error.message
        );

        // Retry logic
        if (retries < this.clerkThrottle.maxRetries) {
          console.log(
            `🔄 Retrying email fetch for member ${member._id} (attempt ${
              retries + 2
            })`
          );

          // Add back to queue with incremented retry count
          this.clerkThrottle.queue.unshift({
            member,
            resolve,
            reject,
            retries: retries + 1,
          });

          // Wait before retry
          await new Promise((resolve) =>
            setTimeout(resolve, this.clerkThrottle.retryDelay)
          );
        } else {
          console.error(`❌ Max retries exceeded for member ${member._id}`);
          reject(
            new Error(
              `Failed to fetch email from Clerk after ${this.clerkThrottle.maxRetries} attempts: ${error.message}`
            )
          );
        }
      }
    }

    this.clerkThrottle.processing = false;
  }

  /**
   * Connect to MongoDB database (if not already connected)
   */
  async connectDatabase() {
    try {
      // Only connect if not already connected
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(mongoUrl);
        console.log("✅ Connected to MongoDB");
      }
    } catch (error) {
      console.error("❌ Failed to connect to MongoDB:", error.message);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB database (only if we connected)
   */
  async disconnectDatabase(force = false) {
    try {
      // Only disconnect if running standalone or forced
      if (force && mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
        console.log("✅ Disconnected from MongoDB");
      }
    } catch (error) {
      console.error("❌ Failed to disconnect from MongoDB:", error.message);
    }
  }

  /**
   * Find orders for events happening tomorrow that need reminder notifications
   */
  async findOrdersNeedingReminders() {
    try {
      // Calculate tomorrow's date in local timezone, then convert to UTC
      const tomorrow = moment().tz(TIMEZONE).add(1, "day").startOf("day").utc();

      console.log(
        `🔍 Looking for events on ${tomorrow.format(
          "YYYY-MM-DD"
        )} (UTC) - sending reminders 1 day early`
      );

      // Query for orders that:
      // 1. Have events starting tomorrow
      // 2. Are completed (not pending, cancelled, etc.)
      // 3. Haven't had reminder notifications sent yet

      // First, get all completed orders with generated tickets that need reminders
      // Only include orders created longer than 4 days ago
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

      const orders = await OrderModel.find({
        status: "completed",
        $or: [
          { reminderNotificationStatus: "pending" },
          { reminderNotificationStatus: null },
          { reminderNotificationStatus: { $exists: false } },
        ],
        ticketsPdfStatus: "generated",
        createdDate: { $lt: fourDaysAgo },
      })
        .populate([
          {
            path: "member",
            select: "firstName lastName email name maskedEmail clerkUserId",
          },
          {
            path: "event",
            select: "title startDate startTime endTime description location",
            populate: {
              path: "location",
              select: "name address1 city state zip",
            },
          },
          {
            path: "organization",
            select: "name email phone defaultImage",
          },
          {
            path: "lineItems",
            populate: {
              path: "ticketType",
              select: "name price",
            },
          },
        ])
        .then((orders) => {
          return orders.filter((order) => {
            try {
              // Compare dates as UTC strings since both are stored as UTC
              const eventStartDate = order.event?.startDate;
              const tomorrowDate = tomorrow.toISOString().split("T")[0]; // Get YYYY-MM-DD

              // Handle both string and Date object cases
              let eventStartDateOnly;
              if (typeof eventStartDate === "string") {
                eventStartDateOnly = eventStartDate.split("T")[0];
              } else if (eventStartDate instanceof Date) {
                eventStartDateOnly = eventStartDate.toISOString().split("T")[0];
              } else {
                return false; // Invalid date format
              }

              if (!eventStartDateOnly || !tomorrowDate) {
                return false;
              }

              return eventStartDateOnly === tomorrowDate;
            } catch (error) {
              console.error(
                `❌ Error finding orders needing reminders:`,
                error.message
              );
              return false;
            }
          });
        });

      console.log(
        `📊 Found ${orders.length} total orders with generated tickets that need reminders`
      );

      console.log(
        `📊 Found ${orders.length} orders that need reminder notifications`
      );
      return orders;
    } catch (error) {
      console.error(
        "❌ Error finding orders needing reminders:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Send reminder notification for a single order
   */
  async sendReminderForOrder(order) {
    let memberEmail = null;

    try {
      console.log(
        `📧 Processing reminder for Order ${order._id} (Event: ${order.event?.title})`
      );

      // Set status to generating to prevent duplicate processing
      await OrderModel.findByIdAndUpdate(order._id, {
        reminderNotificationStatus: "generating",
        updatedDate: new Date(),
      });

      // Validate that we have the required data
      if (!order.member) {
        throw new Error("Order has no member data");
      }

      if (!order.event) {
        throw new Error("Order has no event data");
      }

      if (!order.organization) {
        throw new Error("Order has no organization data");
      }

      // Check if member has clerkUserId for Clerk API call
      if (!order.member.clerkUserId) {
        throw new Error(
          `Member ${order.member._id} has no clerkUserId - cannot fetch email from Clerk`
        );
      }

      // Get member email from Clerk using throttled API calls
      try {
        memberEmail = await this.getEmailFromClerkThrottled(order.member);
        console.log(
          `📧 Retrieved email for member ${
            order.member._id
          }: ${this.maskEmailForLogging(memberEmail)}`
        );
      } catch (emailError) {
        throw new Error(
          `Failed to get member email from Clerk: ${emailError.message}`
        );
      }

      // Use the static method we added to the Order model
      const result = await OrderModel.createReminderNotification(order);

      if (result.success) {
        console.log(`✅ Reminder sent successfully for Order ${order._id}`);
        this.stats.remindersSent++;
        return true;
      } else {
        throw new Error(
          result.error || "Unknown error creating reminder notification"
        );
      }
    } catch (error) {
      console.error(
        `❌ Error sending reminder for Order ${order._id}:`,
        error.message
      );

      // Update order status to failed
      try {
        await OrderModel.findByIdAndUpdate(order._id, {
          reminderNotificationStatus: "failed",
          reminderNotificationError: error.message,
          updatedDate: new Date(),
        });
      } catch (updateError) {
        console.error(
          `❌ Failed to update order status for Order ${order._id}:`,
          updateError.message
        );
      }

      this.stats.errors++;
      this.stats.errorDetails.push({
        orderId: order._id,
        eventTitle: order.event?.title,
        memberEmail: memberEmail
          ? this.maskEmailForLogging(memberEmail)
          : "unknown",
        clerkUserId: order.member?.clerkUserId || "missing",
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Mask email address for logging privacy
   */
  maskEmailForLogging(email) {
    if (!email || typeof email !== "string") return "unknown";

    const [username, domain] = email.split("@");
    if (!username || !domain) return "invalid-email";

    const maskedUsername =
      username.length > 2
        ? username.substring(0, 2) + "*".repeat(username.length - 2)
        : username.substring(0, 1) + "*";

    return `${maskedUsername}@${domain}`;
  }

  /**
   * Process all orders that need reminders
   */
  async processReminders() {
    try {
      // Find orders needing reminders
      const orders = await this.findOrdersNeedingReminders();

      if (orders.length === 0) {
        console.log("ℹ️  No orders found that need reminder notifications");
        return;
      }

      // Process each order
      console.log(`🚀 Processing ${orders.length} orders...`);

      for (const order of orders) {
        this.stats.ordersProcessed++;

        try {
          console.log(`🚀 Sending reminder for Order ${order._id}`);
          // await this.sendReminderForOrder(order);

          // Add a small delay between emails to avoid overwhelming the email service
          if (orders.length > 10) {
            await this.sleep(100); // 100ms delay
          }
        } catch (error) {
          console.error(
            `❌ Failed to process Order ${order._id}:`,
            error.message
          );
        }
      }
    } catch (error) {
      console.error("❌ Error processing reminders:", error.message);
      throw error;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Print summary statistics
   */
  printSummary() {
    const endTime = new Date();
    const duration = (endTime - this.stats.startTime) / 1000;

    console.log("\n📊 TICKET REMINDER WORKER SUMMARY");
    console.log("=====================================");
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📝 Orders Processed: ${this.stats.ordersProcessed}`);
    console.log(`📧 Reminders Sent: ${this.stats.remindersSent}`);
    console.log(`⏭️  Reminders Skipped: ${this.stats.remindersSkipped}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    console.log(
      `🔄 Clerk API Rate Limit: ${this.clerkThrottle.rateLimitDelay}ms delay`
    );
    console.log(`🔄 Clerk API Max Retries: ${this.clerkThrottle.maxRetries}`);

    if (this.stats.errorDetails.length > 0) {
      console.log("\n❌ ERROR DETAILS:");
      this.stats.errorDetails.forEach((error, index) => {
        console.log(
          `${index + 1}. Order ${error.orderId} (${error.eventTitle}):`
        );
        console.log(`     Member Email: ${error.memberEmail}`);
        console.log(`     Clerk User ID: ${error.clerkUserId}`);
        console.log(`     Error: ${error.error}`);
      });
    }

    console.log("\n✅ Worker completed successfully");
  }

  /**
   * Main worker execution (standalone mode)
   */
  async run(standalone = true) {
    try {
      console.log("🚀 Starting Ticket Reminder Worker...");
      console.log(`⏰ Started at: ${this.stats.startTime.toISOString()}`);
      console.log(`🌍 Timezone: ${TIMEZONE}`);

      // Connect to database if running standalone
      if (standalone) {
        await this.connectDatabase();
      }

      // Process reminders
      await this.processReminders();

      // Print summary
      this.printSummary();
    } catch (error) {
      console.error("💥 Worker failed with error:", error.message);
      console.error(error.stack);
      if (standalone) {
        process.exit(1);
      } else {
        throw error; // Re-throw for service runner to handle
      }
    } finally {
      // Only disconnect if running standalone
      if (standalone) {
        await this.disconnectDatabase(true);
      }
    }
  }

  /**
   * Run just the reminder processing (for use by service runner)
   * Assumes database is already connected
   */
  async runAsService() {
    try {
      console.log("🚀 Starting Ticket Reminder Worker (Service Mode)...");
      console.log(`⏰ Started at: ${this.stats.startTime.toISOString()}`);
      console.log(`🌍 Timezone: ${TIMEZONE}`);

      // Process reminders (no database connection/disconnection)
      await this.processReminders();

      console.log("✅ Worker completed successfully");
      return {
        success: true,
        stats: this.stats,
      };
    } catch (error) {
      console.error("💥 Worker failed with error:", error.message);
      return {
        success: false,
        error: error.message,
        stats: this.stats,
      };
    }
  }
}

// Run the worker if this file is executed directly
if (require.main === module) {
  const worker = new TicketReminderWorker();
  worker
    .run()
    .then(() => {
      console.log("🎉 Worker finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Worker failed:", error.message);
      process.exit(1);
    });
}

module.exports = TicketReminderWorker;
