const { queues, ensureQueueReady } = require("./index");
const mongoose = require("mongoose");

// Import required services
const { sendEmail } = require("../sendGrid/sendEmail");
// Email worker now handles only email notifications

/**
 * Process email sending jobs
 */
const processEmailSending = async (job) => {
  const {
    type,
    notificationId,
    recipient,
    templateData,
    templateSlug,
    organizationId,
  } = job.data;

  console.log(
    `📧 Processing email job: ${type} for notification ${notificationId}`
  );

  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URL || process.env.MONGO_URI);
    }

    // Get the Notification model
    const NotificationModel = require("../../services/notifications/notifications.model");

    let notification;
    let receiver;

    if (notificationId) {
      // Load notification from database
      notification = await NotificationModel.findById(notificationId);
      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`);
      }

      // Get receiver information
      receiver = await NotificationModel.getReceiver(
        notification.recipient,
        notification.templateData,
        notification.modelData,
        organizationId || notification.organization
      );

      if (!receiver) {
        throw new Error("Unable to determine notification receiver");
      }
    } else {
      // Use provided recipient data (for direct sending)
      receiver = recipient;
      notification = {
        type,
        title: job.data.title || "Notification",
        message: job.data.message || "",
        templateSlug,
        templateData,
        organization: organizationId,
      };
    }

    let result = false;

    switch (type) {
      case "email": {
        console.log(`📧 Sending email notification`);
        // Build email payload and send directly to avoid recursive enqueues
        const to = {
          email: receiver.email,
          name:
            receiver.name ||
            `${receiver.firstName || ""} ${receiver.lastName || ""}`.trim(),
        };
        const from = {
          email: process.env.SENDGRID_FROM_EMAIL || "no-reply@scaleai.com",
          name: process.env.SENDGRID_FROM_NAME || "ScaleAI",
        };

        await sendEmail({
          to,
          from,
          subject: notification.title,
          text: notification.message,
          templateSlug: notification.templateSlug,
          templateData: notification.templateData,
          modelData: notification.modelData,
          organizationId: organizationId || notification.organization,
          populateTemplateData: true,
        });
        result = true;
        break;
      }

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    if (result) {
      console.log(`✅ ${type.toUpperCase()} notification sent successfully`);

      // Update notification status if we have a notification ID
      if (notificationId) {
        const statusUpdate = {};
        if (type === "email") {
          statusUpdate["metadata.emailQueued"] = false;
          statusUpdate["metadata.emailSent"] = true;
          statusUpdate["metadata.emailError"] = null;
        }
        // Reflect final delivery state on the notification
        statusUpdate.status = "Sent";

        await NotificationModel.findByIdAndUpdate(notificationId, statusUpdate);
      }

      return {
        success: true,
        type,
        notificationId,
        sentAt: new Date().toISOString(),
      };
    } else {
      throw new Error(`${type} notification failed to send`);
    }
  } catch (error) {
    console.error(
      `❌ Email job failed: ${type} for notification ${notificationId}`,
      error
    );

    // Update notification with failure status
    if (notificationId) {
      try {
        const NotificationModel = require("../../services/notifications/notifications.model");
        const statusUpdate = {};
        statusUpdate["metadata.emailError"] = error.message;
        statusUpdate.status = "Failed";

        await NotificationModel.findByIdAndUpdate(notificationId, statusUpdate);
      } catch (updateError) {
        console.error(
          "Failed to update notification with error status:",
          updateError
        );
      }
    }

    throw error;
  }
};

/**
 * Initialize email sending worker
 */
const initEmailWorker = () => {
  console.log("📧 Initializing email sending worker...");

  // Process email sending jobs with concurrency
  queues.emailSending.process("send-notification", 2, processEmailSending);

  // Catch-all processor for legacy/unnamed jobs
  queues.emailSending.process(2, processEmailSending);

  // Handle job completion
  queues.emailSending.on("completed", (job, result) => {
    console.log(
      `✅ Email job completed: ${job.data.type} for notification ${job.data.notificationId}`
    );
  });

  // Handle job failure
  queues.emailSending.on("failed", (job, err) => {
    console.error(
      `❌ Email job failed: ${job.data.type} for notification ${job.data.notificationId}`,
      err.message
    );
  });

  // Handle job stalled
  queues.emailSending.on("stalled", (jobId) => {
    console.warn(`⚠️ Email job stalled: ${jobId}`);
  });

  // Handle stalled job recovery
  queues.emailSending.on("stalled", async (jobId) => {
    console.log(`🔄 Attempting to recover stalled email job: ${jobId}`);
    try {
      const job = await queues.emailSending.getJob(jobId);
      if (job) {
        await job.retry();
        console.log(`✅ Retried stalled email job: ${jobId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to retry stalled email job ${jobId}:`, error);
    }
  });

  // Log when worker starts processing
  queues.emailSending.on("active", (job) => {
    console.log(
      `🔄 Email worker processing job ${job.id}: ${job.data.type} for notification ${job.data.notificationId}`
    );
  });

  console.log("✅ Email sending worker initialized");
};

/**
 * Add email sending job to queue
 */
const enqueueEmailSending = async (data) => {
  console.log(`📋 Enqueuing email job`);

  // Ensure queue connection is ready
  await ensureQueueReady(queues.emailSending, "emailSending");

  const jobData = {
    type: "email",
    ...data,
    enqueuedAt: new Date().toISOString(),
  };

  const job = await queues.emailSending.add("send-notification", jobData, {
    priority: getJobPriority(),
    delay: getJobDelay(),
  });

  console.log(`📋 Email job enqueued: ${job.id}`);

  return job;
};

/**
 * Get job priority based on type
 */
const getJobPriority = () => 3; // Medium priority for emails

/**
 * Get job delay based on type
 */
const getJobDelay = () => 100; // 100ms delay to prevent bursts

module.exports = {
  initEmailWorker,
  enqueueEmailSending,
  processEmailSending,
};
