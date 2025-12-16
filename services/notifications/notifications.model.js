const mongoose = require("mongoose"),
  baseSchema = require("../../lib/baseSchema");

const NotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["email", "sms", "push", "web"],
      required: true,
    },
    recipient: {
      id: { type: mongoose.Schema.Types.ObjectId, required: false },
      type: {
        type: String,
        enum: ["User", "Member", "Admin", "Guest"],
        required: true,
      },
      ref: { type: String, required: true }, // Stores the model name dynamically
    },
    sender: { type: String, required: false },
    title: { type: String, required: true },
    message: { type: String, required: true },
    templateSlug: { type: String, required: false },
    html: { type: String, required: false },
    text: { type: String, required: false },
    templateData: { type: Object, required: false },
    modelData: { type: Object, required: false }, // New field to store IDs for template population
    status: {
      type: String,
      enum: ["Pending", "Sent", "Failed", "Read", "Deleted", "Unread"],
      default: "Pending",
    },
    metadata: {
      emailSent: { type: Boolean, default: false },
      emailQueued: { type: Boolean, default: false },
      emailError: { type: String },
      smsSent: { type: Boolean, default: false },
      smsQueued: { type: Boolean, default: false },
      smsError: { type: String },
      pushSent: { type: Boolean, default: false },
      pushQueued: { type: Boolean, default: false },
      pushError: { type: String },
    },
  },
  {
    strict: false,
  }
);

// Add the base schema fields
NotificationSchema.add(baseSchema);

NotificationSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

NotificationSchema.set("toJSON", {
  virtuals: true,
});

// Static method: getReceiver
NotificationSchema.statics.getReceiver = async function (
  recipient,
  templateData,
  modelData,
  organizationId
) {
  if (recipient.type === "Guest") {
    // For guests (users who don't exist yet), use email from templateData
    if (!templateData || (!templateData.email && !templateData.phoneNumber)) {
      console.log(
        "Cannot send notification to Guest: email or phoneNumber not provided in templateData"
      );
      return null;
    }
    return {
      email: templateData.email,
      phoneNumber: templateData.phoneNumber,
      preferences: { email: true, sms: true, push: true }, // Assume guests want all notifications
      deviceTokens: templateData.deviceTokens || [], // Get device tokens from template data if available
    };
  } else if (recipient.type === "Member") {
    // Handle Members using local database
    try {
      const Member = require("../members/member.model");

      // Use recipient.id if available, otherwise use modelData.member
      const memberId =
        recipient.id ||
        recipient._id ||
        modelData?.member?._id ||
        modelData?.member?.id ||
        modelData?.member;

      if (!memberId) {
        console.log("No member ID provided for Member recipient");
        return null;
      }

      // Use findById since modelData.member contains MongoDB ObjectIds, not Clerk user IDs
      const member = await Member.findById(memberId);

      if (!member) {
        console.log(`Member ${memberId} not found in database`);
        return null;
      }

      // Fetch the organization document if organizationId is provided
      if (organizationId) {
        const Organization = require("../organizations/organization.model");
        const organization = await Organization.findById(organizationId);

        if (!organization) {
          console.log(`Organization ${organizationId} not found`);
          return null;
        }

        // Check if member is in the organization
        const orgMembership = member.getOrganizationMembership(organization);
        if (!orgMembership) {
          console.log(
            `Member ${memberId} not found in organization ${organizationId}`
          );
          return null;
        }
      }

      // Get email and phone from Clerk since they're no longer stored locally
      const email = await member.getEmailFromClerk();

      // Get device tokens from member's devices array
      const memberWithDevices = await Member.findById(member._id).populate(
        "devices"
      );
      const activeDeviceTokens =
        memberWithDevices?.devices
          ?.filter(
            (device) => device.status === "active" && device.expoPushToken
          )
          ?.map((device) => device.expoPushToken) || [];

      return {
        email: email,
        name: member.fullName || member.name,
        preferences: member.preferences || {
          email: true,
          sms: true,
          push: true,
        },
        deviceTokens: activeDeviceTokens,
      };
    } catch (error) {
      console.error("Error fetching member from database:", error);
      return null;
    }
  } else if (recipient.ref === "Organization") {
    // TODO: This case checks recipient.ref instead of recipient.type, and "Organization"
    // is not a valid recipient.type in the schema enum ["User", "Member", "Admin", "Guest"].
    // This should be reviewed and either removed or updated to use a valid type.
    // Handle Organization using Clerk
    try {
      const { clerkClient } = require("@clerk/express");

      const orgId = recipient.id || organizationId;
      if (!orgId) {
        console.log("No organization ID provided for Organization recipient");
        return null;
      }

      const organization = await clerkClient.organizations.getOrganization({
        organizationId: orgId,
      });

      if (!organization) {
        console.log(`Organization ${orgId} not found in Clerk`);
        return null;
      }

      // For organizations, we might want to get the admin's contact info
      // This is a placeholder - adjust based on your needs
      return {
        email: organization.publicMetadata?.contactEmail || null,
        name: organization.name,
        phoneNumber: organization.publicMetadata?.contactPhone || null,
        preferences: { email: true, sms: true, push: true },
        deviceTokens: organization.publicMetadata?.deviceTokens || [],
      };
    } catch (error) {
      console.error("Error fetching organization from Clerk:", error);
      return null;
    }
  } else {
    // Handle other recipient types using MongoDB models if they exist
    try {
      // Check if the model exists before trying to use it
      if (!mongoose.models[recipient.ref]) {
        console.log(
          `Model "${recipient.ref}" is not registered. Available models:`,
          Object.keys(mongoose.models)
        );
        return null;
      }

      const RecipientModel = mongoose.model(recipient.ref);
      const receiver = await RecipientModel.findById(recipient.id);
      if (!receiver) {
        console.log(`${recipient.type} ${recipient.id} not found`);
        return null;
      }
      return receiver;
    } catch (error) {
      console.error(`Error fetching ${recipient.ref} model:`, error);
      return null;
    }
  }
};

// Static method: getOrganization
NotificationSchema.statics.getOrganization = async function (organizationId) {
  try {
    const Organization = require("../organizations/organization.model");

    const organization = await Organization.findById(organizationId);

    return organization;
  } catch (error) {
    console.log(
      `Failed to send notification. Organization ${organizationId} not found:`,
      error
    );
    return null;
  }
};

// Static method: checkRecipientPreferences
NotificationSchema.statics.checkRecipientPreferences = function (
  receiver,
  notificationType
) {
  if (receiver?.preferences && !receiver.preferences[notificationType]) {
    console.log(
      `${
        receiver.email || receiver.phoneNumber
      } does not want to receive ${notificationType} notifications`
    );
    return false;
  }
  return true;
};

// Static method: sendEmailNotification
NotificationSchema.statics.sendEmailNotification = async function (
  notification,
  receiver
) {
  try {
    // Check if email has already been sent or is already queued
    if (notification.metadata?.emailSent) {
      console.log(
        `📧 Email already sent for notification ${notification._id}, skipping`
      );
      return true;
    }

    if (notification.metadata?.emailQueued) {
      console.log(
        `📧 Email already queued for notification ${notification._id}, skipping`
      );
      return true;
    }

    const { enqueueEmailSending } = require("../../lib/queues/email-worker");

    // Enqueue email sending job
    const job = await enqueueEmailSending({
      notificationId: notification._id.toString(),
      recipient: receiver,
      templateData: notification.templateData,
      templateSlug: notification.templateSlug,
      organizationId:
        notification.organization?._id || notification.organization,
      title: notification.title,
      message: notification.message,
    });

    console.log(
      `📧 Email notification job enqueued for notification ${notification._id}: ${job.id}`
    );

    // Set status to indicate job is queued (don't mark as sent yet)
    await notification.constructor.findByIdAndUpdate(notification._id, {
      "metadata.emailQueued": true,
    });

    return true;
  } catch (error) {
    console.error("Error enqueuing email notification:", error);
    // Store the error
    await notification.constructor.findByIdAndUpdate(notification._id, {
      "metadata.emailError": error.message,
    });
    return false;
  }
};

// Static method: sendSmsNotification
NotificationSchema.statics.sendSmsNotification = async function (
  notification,
  receiver,
  organization
) {
  try {
    // Check if SMS has already been sent or is already queued
    if (notification.metadata?.smsSent) {
      console.log(
        `📱 SMS already sent for notification ${notification._id}, skipping`
      );
      return true;
    }

    if (notification.metadata?.smsQueued) {
      console.log(
        `📱 SMS already queued for notification ${notification._id}, skipping`
      );
      return true;
    }

    const { enqueueSmsSending } = require("../../lib/queues/sms-worker");

    // Enqueue SMS sending job
    const job = await enqueueSmsSending({
      notificationId: notification._id.toString(),
      recipient: receiver,
      templateData: notification.templateData,
      templateSlug: notification.templateSlug,
      organizationId: organization._id,
      title: notification.title,
      message: notification.message,
    });

    console.log(
      `📱 SMS notification job enqueued for notification ${notification._id}: ${job.id}`
    );

    // Set status to indicate job is queued (don't mark as sent yet)
    await notification.constructor.findByIdAndUpdate(notification._id, {
      "metadata.smsQueued": true,
    });

    return true;
  } catch (error) {
    console.error("Error enqueuing SMS notification:", error);
    // Store the error
    await notification.constructor.findByIdAndUpdate(notification._id, {
      "metadata.smsError": error.message,
    });
    return false;
  }
};

// Static method: sendPushNotification
NotificationSchema.statics.sendPushNotification = async function (
  notification,
  receiver,
  organization
) {
  try {
    // Check if push notification has already been sent or is already queued
    if (notification.metadata?.pushSent) {
      console.log(
        `📲 Push notification already sent for notification ${notification._id}, skipping`
      );
      return true;
    }

    if (notification.metadata?.pushQueued) {
      console.log(
        `📲 Push notification already queued for notification ${notification._id}, skipping`
      );
      return true;
    }

    const { enqueuePushSending } = require("../../lib/queues/push-worker");

    // Enqueue push notification job
    const job = await enqueuePushSending({
      notificationId: notification._id.toString(),
      recipient: receiver,
      templateData: notification.templateData,
      templateSlug: notification.templateSlug,
      organizationId: organization._id,
      title: notification.title,
      message: notification.message,
    });

    console.log(
      `📲 Push notification job enqueued for notification ${notification._id}: ${job.id}`
    );

    // Set status to indicate job is queued (don't mark as sent yet)
    await notification.constructor.findByIdAndUpdate(notification._id, {
      "metadata.pushQueued": true,
    });

    return true;
  } catch (error) {
    console.error("Error enqueuing push notification:", error);
    // Store the error
    await notification.constructor.findByIdAndUpdate(notification._id, {
      "metadata.pushError": error.message,
    });
    return false;
  }
};

NotificationSchema.post("save", async function () {
  try {
    // For email notifications that haven't been sent yet
    if (this.type === "email" && !this.metadata.emailSent) {
      const receiver = await this.constructor.getReceiver(
        this.recipient,
        this.templateData,
        this.modelData,
        this.organization
      );
      if (!receiver) return;

      if (!this.constructor.checkRecipientPreferences(receiver, "email"))
        return;

      await this.constructor.sendEmailNotification(this, receiver);
    } else if (this.type === "sms" && !this.metadata.smsSent) {
      const receiver = await this.constructor.getReceiver(
        this.recipient,
        this.templateData,
        this.modelData,
        this.organization
      );
      if (!receiver) return;

      // Check if receiver has a phone number
      if (!receiver.phoneNumber) {
        console.log(
          `Cannot send SMS to ${this.recipient.type} ${this.recipient.id}: phone number not provided`
        );
        return;
      }

      const organization = await this.constructor.getOrganization(
        this.organization
      );
      if (!organization) return;

      if (!this.constructor.checkRecipientPreferences(receiver, "sms")) {
        console.log(
          `Cannot send SMS to ${this.recipient.type} ${this.recipient.id}: preferences not set`
        );
        return;
      }

      await this.constructor.sendSmsNotification(this, receiver, organization);
    } else if (this.type === "push" && !this.metadata.pushSent) {
      const receiver = await this.constructor.getReceiver(
        this.recipient,
        this.templateData,
        this.modelData,
        this.organization
      );
      if (!receiver) return;

      // Check if receiver has device tokens or can get them
      if (!receiver.deviceTokens && !receiver.id && !receiver.userId) {
        console.log(
          `Cannot send push notification to ${this.recipient.type} ${this.recipient.id}: no device tokens or user ID provided`
        );
        return;
      }

      const organization = await this.constructor.getOrganization(
        this.organization
      );
      if (!organization) return;

      if (!this.constructor.checkRecipientPreferences(receiver, "push")) {
        console.log(
          `Cannot send push notification to ${this.recipient.type} ${this.recipient.id}: preferences not set`
        );
        return;
      }

      await this.constructor.sendPushNotification(this, receiver, organization);
    }
  } catch (error) {
    console.error("Error in notification post-save hook:", error);
  }
});

module.exports = mongoose.model("Notification", NotificationSchema);
