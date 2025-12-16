const mongoose = require("mongoose");
const EventInvitation = require("../../eventInvitations/eventInvitations.model");

/**
 * Handle Telnyx webhook events
 * Processes delivery status updates and incoming messages
 */
exports.handleWebhook = async (req, res) => {
  try {
    const event = req.telnyxEvent;

    if (!event || !event.data) {
      console.error("Invalid Telnyx webhook payload");
      return res.status(400).json({ error: "Invalid payload" });
    }

    const { event_type, payload } = event.data;

    console.log(`Received Telnyx webhook: ${event_type}`);

    switch (event_type) {
      case "message.finalized":
        await handleDeliveryStatusUpdate(payload);
        break;

      case "message.received":
        await handleIncomingMessage(payload);
        break;

      default:
        console.log(`Unhandled Telnyx event type: ${event_type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing Telnyx webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Handle delivery status updates for outbound messages
 * Updates EventInvitation status based on delivery confirmation
 */
async function handleDeliveryStatusUpdate(payload) {
  try {
    const { id: messageId, to, from, direction, errors } = payload;

    // Only process outbound messages
    if (direction !== "outbound") {
      return;
    }

    // Find the recipient phone number
    const recipientPhone = to && to.length > 0 ? to[0].phone_number : null;
    if (!recipientPhone) {
      console.error("No recipient phone number in delivery status update");
      return;
    }

    // Find the corresponding event invitation
    const invitation = await EventInvitation.findOne({
      phoneNumber: recipientPhone,
      status: { $in: ["pending", "sent"] },
    }).populate("event");

    if (!invitation) {
      console.log(`No invitation found for phone number: ${recipientPhone}`);
      return;
    }

    // Determine the new status based on delivery status
    let newStatus = "sent";
    let lastError = null;
    let metadata = {};

    // Check for delivery errors
    if (errors && errors.length > 0) {
      newStatus = "failed";
      lastError = errors.map((err) => err.detail || err.title).join("; ");
    } else {
      // Check recipient status
      const recipientStatus = to[0].status;
      switch (recipientStatus) {
        case "delivered":
          newStatus = "delivered";
          break;
        case "delivery_failed":
          newStatus = "failed";
          lastError = "Delivery failed by carrier";
          break;
        case "sending_failed":
          newStatus = "failed";
          lastError = "Sending failed";
          break;
        case "delivery_unconfirmed":
          newStatus = "sent"; // Keep as sent if unconfirmed
          break;
        default:
          newStatus = "sent";
      }
    }

    // Update invitation with delivery status
    const updateData = {
      status: newStatus,
      lastError,
      metadata: {
        ...invitation.metadata,
        telnyxMessageId: messageId,
        deliveryStatus: to[0]?.status,
        carrier: to[0]?.carrier,
        lineType: to[0]?.line_type,
        cost: payload.cost,
        completedAt: payload.completed_at,
        lastWebhookUpdate: new Date(),
      },
    };

    // If delivered, update sentAt if not already set
    if (newStatus === "delivered" && !invitation.sentAt) {
      updateData.sentAt = new Date();
    }

    await EventInvitation.findByIdAndUpdate(invitation._id, updateData);

    console.log(
      `Updated invitation ${invitation._id} status to ${newStatus} for phone ${recipientPhone}`
    );

    // Log delivery status for monitoring
    if (newStatus === "failed") {
      console.error(
        `SMS delivery failed for invitation ${invitation._id}: ${lastError}`
      );
    } else if (newStatus === "delivered") {
      console.log(
        `SMS delivered successfully for invitation ${invitation._id}`
      );
    }
  } catch (error) {
    console.error("Error handling delivery status update:", error);
    throw error;
  }
}

/**
 * Handle incoming messages (for future use)
 * Could be used for RSVP responses or other interactions
 */
async function handleIncomingMessage(payload) {
  try {
    const { from, to, text, id: messageId } = payload;

    console.log(`Received incoming SMS from ${from.phone_number}: ${text}`);

    // Find the corresponding event invitation
    const invitation = await EventInvitation.findOne({
      phoneNumber: from.phone_number,
    }).populate("event");

    if (invitation) {
      // Update invitation with incoming message info
      await EventInvitation.findByIdAndUpdate(invitation._id, {
        metadata: {
          ...invitation.metadata,
          lastIncomingMessage: {
            text,
            messageId,
            receivedAt: new Date(),
          },
        },
      });

      console.log(`Updated invitation ${invitation._id} with incoming message`);
    }

    // TODO: Implement RSVP response parsing
    // Could parse text for "YES", "NO", "MAYBE" responses
    // and update invitation or create RSVP records
  } catch (error) {
    console.error("Error handling incoming message:", error);
    throw error;
  }
}

/**
 * Get delivery status statistics for an event
 * Useful for dashboard displays
 */
exports.getDeliveryStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizationId = req.organization._id;

    const stats = await EventInvitation.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          organization: organizationId,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.json({
      eventId,
      statusCounts,
      total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
    });
  } catch (error) {
    console.error("Error getting delivery stats:", error);
    res.status(500).json({ error: "Failed to get delivery stats" });
  }
};
