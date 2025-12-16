const { queues, ensureQueueReady } = require("./index");
const mongoose = require("mongoose");

// Import required services
const { sendSMS } = require("../telnyx/sendSMS");

/**
 * Process SMS sending jobs
 */
const processSmsSending = async (job) => {
  const {
    type,
    notificationId,
    recipient,
    templateData,
    templateSlug,
    organizationId,
    message,
  } = job.data;

  console.log(`📱 Processing SMS job for notification ${notificationId}`);

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
        type: "sms",
        title: job.data.title || "Notification",
        message: message || job.data.message || "",
        templateSlug,
        templateData,
        organization: organizationId,
      };
    }

    if (!receiver.phoneNumber) {
      throw new Error("Recipient phone number is required for SMS");
    }

    const organization = await NotificationModel.getOrganization(
      organizationId || notification.organization
    );

    await sendSMS({
      to: receiver.phoneNumber,
      from: process.env.TELNYX_FROM_NUMBER,
      templateSlug: notification.templateSlug,
      templateData: notification.templateData,
      modelData: notification.modelData,
      organizationId: organization?._id || organizationId,
      messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID,
      body: notification.message,
    });

    // Update notification status if we have a notification ID
    if (notificationId) {
      const statusUpdate = {
        "metadata.smsQueued": false,
        "metadata.smsSent": true,
        "metadata.smsError": null,
        status: "Sent",
      };
      await NotificationModel.findByIdAndUpdate(notificationId, statusUpdate);
    }

    return {
      success: true,
      type: "sms",
      notificationId,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      `❌ SMS job failed for notification ${notificationId}`,
      error
    );

    // Update notification with failure status
    if (notificationId) {
      try {
        const NotificationModel = require("../../services/notifications/notifications.model");
        const statusUpdate = {
          "metadata.smsError": error.message,
          status: "Failed",
        };
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
 * Initialize SMS sending worker
 */
const initSmsWorker = () => {
  console.log("📱 Initializing SMS sending worker...");

  // Process SMS sending jobs with concurrency
  queues.smsSending.process("send-notification", 5, processSmsSending);

  // Catch-all processor for legacy/unnamed jobs
  queues.smsSending.process(5, processSmsSending);

  // Handle job completion
  queues.smsSending.on("completed", (job, result) => {
    console.log(
      `✅ SMS job completed for notification ${job.data.notificationId}`
    );
  });

  // Handle job failure
  queues.smsSending.on("failed", (job, err) => {
    console.error(
      `❌ SMS job failed for notification ${job.data.notificationId}`,
      err.message
    );
  });

  // Handle job stalled
  queues.smsSending.on("stalled", (jobId) => {
    console.warn(`⚠️ SMS job stalled: ${jobId}`);
  });

  // Handle stalled job recovery
  queues.smsSending.on("stalled", async (jobId) => {
    console.log(`🔄 Attempting to recover stalled SMS job: ${jobId}`);
    try {
      const job = await queues.smsSending.getJob(jobId);
      if (job) {
        await job.retry();
        console.log(`✅ Retried stalled SMS job: ${jobId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to retry stalled SMS job ${jobId}:`, error);
    }
  });

  // Log when worker starts processing
  queues.smsSending.on("active", (job) => {
    console.log(
      `🔄 SMS worker processing job ${job.id} for notification ${job.data.notificationId}`
    );
  });

  console.log("✅ SMS sending worker initialized");
};

/**
 * Add SMS sending job to queue
 */
const enqueueSmsSending = async (data) => {
  console.log(`📋 Enqueuing SMS job`);

  // Ensure queue connection is ready
  await ensureQueueReady(queues.smsSending, 'smsSending');

  const jobData = {
    type: "sms",
    ...data,
    enqueuedAt: new Date().toISOString(),
  };

  const job = await queues.smsSending.add("send-notification", jobData, {
    priority: getJobPriority(),
    delay: getJobDelay(),
  });

  console.log(`📋 SMS job enqueued: ${job.id}`);

  return job;
};

/**
 * Get job priority for SMS
 */
const getJobPriority = () => 4; // Higher priority for SMS

/**
 * Get job delay for SMS
 */
const getJobDelay = () => 50; // Small delay to avoid burst

module.exports = {
  initSmsWorker,
  enqueueSmsSending,
  processSmsSending,
};
