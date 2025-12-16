const { queues, ensureQueueReady } = require("./index");
const mongoose = require("mongoose");

// Import required services
const { sendPushNotification } = require("../push-notifications");

/**
 * Process Push sending jobs
 */
const processPushSending = async (job) => {
  const {
    type,
    notificationId,
    recipient,
    templateData,
    templateSlug,
    organizationId,
    title,
    message,
  } = job.data;

  console.log(`📲 Processing push job for notification ${notificationId}`);

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
        type: "push",
        title: title || job.data.title || "Notification",
        message: message || job.data.message || "",
        templateSlug,
        templateData,
        organization: organizationId,
      };
    }

    const pushOrganization = await NotificationModel.getOrganization(
      organizationId || notification.organization
    );

    await sendPushNotification({
      tokens: receiver.deviceTokens || [],
      title: notification.title,
      message: notification.message,
      data: notification.templateData,
      modelData: notification.modelData,
      organizationId: pushOrganization?._id || organizationId,
    });

    // Update notification status if we have a notification ID
    if (notificationId) {
      const statusUpdate = {
        "metadata.pushQueued": false,
        "metadata.pushSent": true,
        "metadata.pushError": null,
        status: "Sent",
      };
      await NotificationModel.findByIdAndUpdate(notificationId, statusUpdate);
    }

    return {
      success: true,
      type: "push",
      notificationId,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      `❌ Push job failed for notification ${notificationId}`,
      error
    );

    // Update notification with failure status
    if (notificationId) {
      try {
        const NotificationModel = require("../../services/notifications/notifications.model");
        const statusUpdate = {
          "metadata.pushError": error.message,
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
 * Initialize Push sending worker
 */
const initPushWorker = () => {
  console.log("📲 Initializing push sending worker...");

  // Process push sending jobs with concurrency
  queues.pushSending.process("send-notification", 2, processPushSending);

  // Catch-all processor for legacy/unnamed jobs
  queues.pushSending.process(2, processPushSending);

  // Handle job completion
  queues.pushSending.on("completed", (job, result) => {
    console.log(
      `✅ Push job completed for notification ${job.data.notificationId}`
    );
  });

  // Handle job failure
  queues.pushSending.on("failed", (job, err) => {
    console.error(
      `❌ Push job failed for notification ${job.data.notificationId}`,
      err.message
    );
  });

  // Handle job stalled
  queues.pushSending.on("stalled", (jobId) => {
    console.warn(`⚠️ Push job stalled: ${jobId}`);
  });

  // Handle stalled job recovery
  queues.pushSending.on("stalled", async (jobId) => {
    console.log(`🔄 Attempting to recover stalled push job: ${jobId}`);
    try {
      const job = await queues.pushSending.getJob(jobId);
      if (job) {
        await job.retry();
        console.log(`✅ Retried stalled push job: ${jobId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to retry stalled push job ${jobId}:`, error);
    }
  });

  // Log when worker starts processing
  queues.pushSending.on("active", (job) => {
    console.log(
      `🔄 Push worker processing job ${job.id} for notification ${job.data.notificationId}`
    );
  });

  console.log("✅ Push sending worker initialized");
};

/**
 * Add Push sending job to queue
 */
const enqueuePushSending = async (data) => {
  console.log(`📋 Enqueuing push job`);

  // Ensure queue connection is ready
  await ensureQueueReady(queues.pushSending, 'pushSending');

  const jobData = {
    type: "push",
    ...data,
    enqueuedAt: new Date().toISOString(),
  };

  const job = await queues.pushSending.add("send-notification", jobData, {
    priority: getJobPriority(),
    delay: getJobDelay(),
  });

  console.log(`📋 Push job enqueued: ${job.id}`);

  return job;
};

/**
 * Get job priority for Push
 */
const getJobPriority = () => 2; // Lower than SMS/Email by default

/**
 * Get job delay for Push
 */
const getJobDelay = () => 200; // Small delay to avoid burst

module.exports = {
  initPushWorker,
  enqueuePushSending,
  processPushSending,
};
