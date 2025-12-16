#!/usr/bin/env node

/**
 * Daily Stats Worker
 *
 * This worker runs daily at 8am CST to send comprehensive statistics
 * emails to organization administrators.
 *
 * Features:
 * - Sends daily dashboard statistics
 * - Organization-specific stats
 * - Sends to all org admins
 * - Includes ticket sales, revenue, check-ins, and event data
 *
 * Usage:
 *   node workers/lib/daily-stats-worker.js [organizationId]
 *
 * Cron setup (8am CST daily):
 *   0 8 * * * cd /path/to/kikits-api && node workers/lib/daily-stats-worker.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const moment = require("moment-timezone");

// Import models and controllers
const MemberModel = require("../../services/members/member.model");
const OrganizationModel = require("../../services/organizations/organization.model");
const NotificationModel = require("../../services/notifications/notifications.model");

// Import stats functions (we'll use the controller logic)
const statsController = require("../../services/stats/stats.controller");

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

class DailyStatsWorker {
  constructor() {
    this.stats = {
      startTime: new Date(),
      organizationsProcessed: 0,
      emailsSent: 0,
      errors: 0,
      errorDetails: [],
    };
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
   * Disconnect from MongoDB database (only if force is true)
   */
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

  /**
   * Get dashboard statistics for an organization
   */
  async getOrganizationStats(organization) {
    try {
      // Create a mock request object that mimics what the stats controller expects
      const mockReq = {
        organization: organization,
        query: {},
      };

      // Create a mock response object to capture the data
      let responseData = null;
      const mockRes = {
        status: () => ({
          json: (data) => {
            responseData = data;
          },
        }),
      };

      // Call the dashboard data function
      await statsController.getDashboardData(mockReq, mockRes);

      if (responseData && responseData.success) {
        return responseData.data;
      } else {
        throw new Error("Failed to get dashboard data");
      }
    } catch (error) {
      console.error(
        `❌ Error getting stats for org ${organization._id}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Get organization administrators
   */
  async getOrganizationAdmins(organizationId) {
    try {
      // Query for members who have an organizationMembership with this org ID and admin role
      const admins = await MemberModel.find({
        organizationMemberships: {
          $elemMatch: {
            organizationId: organizationId,
            role: "org:admin",
          },
        },
      });

      console.log(
        `📋 Found ${admins.length} administrators for organization ${organizationId}`
      );

      // Log admin details for debugging (first admin only)
      if (admins.length > 0) {
        const firstAdmin = admins[0];
        console.log(
          `📧 Sample admin: ${firstAdmin.firstName} ${firstAdmin.lastName} (${firstAdmin.maskedEmail})`
        );
        console.log(
          `🔍 Admin fields: ${Object.keys(
            firstAdmin.toObject ? firstAdmin.toObject() : firstAdmin
          ).join(", ")}`
        );
      }

      return admins;
    } catch (error) {
      console.error(
        `❌ Error getting admins for org ${organizationId}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Format statistics data for email template
   */
  formatStatsForEmail(statsData, organization) {
    const today = moment().tz(TIMEZONE);

    return {
      organization: {
        name: organization.name,
        _id: organization._id,
      },
      reportDate: today.format("MMMM Do, YYYY"),
      reportDay: today.format("dddd"),
      stats: {
        // Quick stats overview
        tickets: statsData.quickStats.tickets,
        revenue: statsData.quickStats.revenue,
        checkIns: statsData.quickStats.checkIns,
        activeEventsToday: statsData.quickStats.activeEventsToday,

        // Event information
        upcomingEventsCount: statsData.upcomingEvents.count,
        upcomingEvents: statsData.upcomingEvents.events.slice(0, 5), // Top 5 upcoming events

        // Transaction summary
        recentTransactionsCount: statsData.transactions.recent.length,
        paymentMethods: statsData.transactions.summary.paymentMethods,

        // Team activity
        teamMembersCount: statsData.team.length,
        activeTeamMembers: statsData.team.filter(
          (member) => member.scanActivity && member.scanActivity.count > 0
        ).length,
      },
      // Helper data for template
      hasUpcomingEvents: statsData.upcomingEvents.count > 0,
      hasRevenue: statsData.quickStats.revenue.gross.allTime > 0,
      hasRecentActivity: statsData.quickStats.checkIns.today > 0,
    };
  }

  /**
   * Send daily stats email to organization admins
   */
  async sendStatsEmail(organization, admins, statsData) {
    try {
      console.log(
        `📧 Sending daily stats to ${admins.length} admins for ${organization.name}`
      );

      // Get the daily stats template
      const templateSlug = "daily-stats";

      // Format stats data for email
      const emailData = this.formatStatsForEmail(statsData, organization);

      let emailsSent = 0;
      const errors = [];

      // Send email to each admin
      for (const admin of admins) {
        try {
          const notification = new NotificationModel({
            createdBy: "system",
            updatedBy: "system",
            createdAt: new Date(),
            updatedAt: new Date(),
            organization: organization._id,
            type: "email",
            recipient: {
              id: admin._id,
              ref: "Member",
              type: "Member",
            },
            sender: "system",
            title: `Daily Statistics for ${organization.name}`,
            message: `Your daily statistics report for ${emailData.reportDate}`,
            templateSlug: templateSlug,
            modelData: {
              member: admin._id,
              organization: organization._id,
              statsData: emailData,
            },
          });

          await notification.save();
          emailsSent++;

          // Use maskedEmail for logging since actual email might not be directly accessible
          const adminEmail =
            admin.maskedEmail || admin.email || `Member ${admin._id}`;
          console.log(`✅ Stats email queued for ${adminEmail}`);
        } catch (emailError) {
          const adminEmail =
            admin.maskedEmail || admin.email || `Member ${admin._id}`;
          console.error(
            `❌ Failed to send stats email to ${adminEmail}:`,
            emailError.message
          );
          errors.push({
            admin: adminEmail,
            error: emailError.message,
          });
        }
      }

      return {
        success: true,
        emailsSent,
        errors,
      };
    } catch (error) {
      console.error(
        `❌ Error sending stats emails for ${organization.name}:`,
        error.message
      );
      return {
        success: false,
        emailsSent: 0,
        errors: [{ organization: organization.name, error: error.message }],
      };
    }
  }

  /**
   * Process daily stats for a specific organization
   */
  async processOrganization(organizationId) {
    try {
      console.log(
        `📊 Processing daily stats for organization: ${organizationId}`
      );

      // Get organization
      const organization = await OrganizationModel.findById(organizationId);
      if (!organization) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      // Get organization administrators
      const admins = await this.getOrganizationAdmins(organizationId);
      if (admins.length === 0) {
        console.log(
          `⚠️  No administrators found for ${organization.name}, skipping`
        );
        return {
          success: true,
          organizationName: organization.name,
          adminsCount: 0,
          emailsSent: 0,
          skipped: true,
        };
      }

      // Get dashboard statistics
      const statsData = await this.getOrganizationStats(organization);

      // Send stats emails
      const emailResult = await this.sendStatsEmail(
        organization,
        admins,
        statsData
      );

      this.stats.organizationsProcessed++;
      this.stats.emailsSent += emailResult.emailsSent;
      this.stats.errors += emailResult.errors.length;
      this.stats.errorDetails.push(...emailResult.errors);

      console.log(`✅ Completed stats processing for ${organization.name}`);
      console.log(
        `   - Admins: ${admins.length}, Emails sent: ${emailResult.emailsSent}`
      );

      return {
        success: true,
        organizationName: organization.name,
        adminsCount: admins.length,
        emailsSent: emailResult.emailsSent,
        errors: emailResult.errors,
      };
    } catch (error) {
      console.error(
        `❌ Error processing organization ${organizationId}:`,
        error.message
      );
      this.stats.errors++;
      this.stats.errorDetails.push({
        organizationId,
        error: error.message,
      });

      return {
        success: false,
        organizationId,
        error: error.message,
      };
    }
  }

  /**
   * Process daily stats for all organizations or a specific one
   */
  async processAllOrganizations(specificOrgId = null) {
    try {
      console.log("🚀 Starting daily stats worker...");
      console.log(
        `📅 Processing date: ${moment()
          .tz(TIMEZONE)
          .format("YYYY-MM-DD HH:mm:ss z")}`
      );

      let organizations;

      if (specificOrgId) {
        // Process specific organization
        console.log(`🎯 Processing specific organization: ${specificOrgId}`);
        organizations = await OrganizationModel.find({ _id: specificOrgId });
        if (organizations.length === 0) {
          throw new Error(`Organization ${specificOrgId} not found`);
        }
      } else {
        // Process all active organizations
        console.log("🌐 Processing all active organizations...");
        organizations = await OrganizationModel.find({
          isActive: { $ne: false }, // Include organizations where isActive is true or undefined
        });
      }

      console.log(
        `📊 Found ${organizations.length} organization(s) to process`
      );

      const results = [];

      // Process each organization
      for (const organization of organizations) {
        const result = await this.processOrganization(organization._id);
        results.push(result);
      }

      // Calculate final stats
      const duration = Date.now() - this.stats.startTime.getTime();

      console.log("\n📈 DAILY STATS WORKER SUMMARY");
      console.log("============================");
      console.log(
        `Organizations processed: ${this.stats.organizationsProcessed}`
      );
      console.log(`Total emails sent: ${this.stats.emailsSent}`);
      console.log(`Errors encountered: ${this.stats.errors}`);
      console.log(`Total duration: ${Math.round(duration / 1000)}s`);

      if (this.stats.errorDetails.length > 0) {
        console.log("\n❌ Error Details:");
        this.stats.errorDetails.forEach((error, index) => {
          console.log(
            `${index + 1}. ${error.organization || error.organizationId}: ${
              error.error
            }`
          );
        });
      }

      return {
        success: this.stats.errors === 0,
        stats: this.stats,
        results,
        duration,
      };
    } catch (error) {
      console.error("💥 Fatal error in daily stats worker:", error.message);
      throw error;
    }
  }

  /**
   * Main execution method for standalone usage
   */
  async run(standalone = true) {
    try {
      if (standalone) {
        await this.connectDatabase();
      }

      // Get organization ID from command line arguments
      const orgId = process.argv[2] || null;

      const result = await this.processAllOrganizations(orgId);

      if (standalone) {
        await this.disconnectDatabase(true);

        // Exit with appropriate code
        process.exit(result.success ? 0 : 1);
      }

      return result;
    } catch (error) {
      console.error("💥 Daily stats worker failed:", error.message);

      if (standalone) {
        await this.disconnectDatabase(true);
        process.exit(1);
      }

      throw error;
    }
  }

  /**
   * Service mode execution (called by ServiceRunner)
   */
  async runAsService(organizationId = null) {
    try {
      const result = await this.processAllOrganizations(organizationId);

      return {
        success: result.success,
        stats: this.stats,
        error: result.success ? null : "Some organizations failed to process",
      };
    } catch (error) {
      console.error("💥 Daily stats worker service failed:", error.message);
      return {
        success: false,
        stats: this.stats,
        error: error.message,
      };
    }
  }
}

// Export the class for use by ServiceRunner
module.exports = DailyStatsWorker;

// If run directly, execute the worker
if (require.main === module) {
  const worker = new DailyStatsWorker();
  worker.run(true);
}
