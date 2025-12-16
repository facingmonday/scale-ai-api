const { queues, ensureQueueReady } = require("./index");
const mongoose = require("mongoose");

// Import models
const OrderModel = require("../../services/order/order.model");
const TicketModel = require("../../services/tickets/tickets.model");

/**
 * Send error alert email when PDF generation fails
 */
const sendPdfErrorAlert = async (error, jobData) => {
  const alertEmail = process.env.PDF_ERROR_ALERT_EMAIL;

  if (!alertEmail) {
    console.warn("PDF_ERROR_ALERT_EMAIL not configured, skipping error alert");
    return;
  }

  try {
    const { sendEmail } = require("../sendGrid/sendEmail");

    const { type, orderId, ticketId, organizationId } = jobData;
    const entityId = orderId || ticketId;
    const entityType = orderId ? "Order" : "Ticket";

    const subject = `PDF Generation Failed: ${type} - ${entityId}`;
    const errorDetails = {
      type,
      entityType,
      entityId,
      organizationId,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
    };

    const html = `
      <h2>PDF Generation Error Alert</h2>
      <p><strong>Type:</strong> ${type}</p>
      <p><strong>${entityType} ID:</strong> ${entityId}</p>
      ${organizationId ? `<p><strong>Organization ID:</strong> ${organizationId}</p>` : ""}
      <p><strong>Error Message:</strong> ${error.message}</p>
      <p><strong>Timestamp:</strong> ${errorDetails.timestamp}</p>
      <hr>
      <h3>Error Stack:</h3>
      <pre style="background: #f5f5f5; padding: 10px; overflow-x: auto;">${error.stack || "No stack trace available"}</pre>
    `;

    const text = `
PDF Generation Error Alert

Type: ${type}
${entityType} ID: ${entityId}
${organizationId ? `Organization ID: ${organizationId}\n` : ""}Error Message: ${error.message}
Timestamp: ${errorDetails.timestamp}

Error Stack:
${error.stack || "No stack trace available"}
    `;

    await sendEmail({
      to: { email: alertEmail },
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || "no-reply@kikits.com",
        name: process.env.SENDGRID_FROM_NAME || "Kikits",
      },
      subject,
      html,
      text,
    });

    console.log(`📧 PDF error alert email sent to ${alertEmail}`);
  } catch (emailError) {
    // Don't let email failures interfere with error handling
    console.error("Failed to send PDF error alert email:", emailError);
  }
};

/**
 * Process PDF generation jobs
 */
const processPdfGeneration = async (job) => {
  const {
    type,
    orderId,
    ticketId,
    organizationId,
    sendNotification = true,
  } = job.data;

  console.log(
    `🔄 Processing PDF generation job: ${type} for ${orderId || ticketId}`
  );

  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URL || process.env.MONGO_URI);
    }

    let result;
    switch (type) {
      case "order-receipt":
        console.log(`📄 Generating receipt PDF for order ${orderId}`);
        const order = await OrderModel.findById(orderId);
        if (!order) {
          throw new Error(`Order ${orderId} not found`);
        }
        // Update status to generating before processing
        order.receiptPdfStatus = "generating";
        await order.save();
        result = await order.generateReceiptPDFSync();
        try {
          if (sendNotification) {
            let notification = null;

            const freshOrder = await OrderModel.findById(orderId).populate([
              { path: "member" },
              { path: "event" },
              { path: "organization" },
            ]);

            if (freshOrder) {
              notification = await TicketModel.createNotification(
                freshOrder,
                "order-created"
              );
            }

            if (notification && notification._id) {
              await OrderModel.findByIdAndUpdate(orderId, {
                $push: { notifications: notification._id },
                $set: {
                  receiptNotificationStatus: "generated",
                  receiptNotificationError: null,
                },
              });
            }
          }
        } catch (notifyErr) {
          console.error(
            "Failed to create order-receipt notification:",
            notifyErr
          );
          try {
            await OrderModel.findByIdAndUpdate(orderId, {
              $set: {
                receiptNotificationStatus: "failed",
                receiptNotificationError: notifyErr.message,
              },
            });
          } catch (_) {}
        }
        break;

      case "order-cancelled":
        console.log(`📄 Generating canceled order PDF for order ${orderId}`);
        const canceledOrder = await OrderModel.findById(orderId);
        if (!canceledOrder) {
          throw new Error(`Order ${orderId} not found`);
        }
        // Update status to generating before processing
        canceledOrder.canceledOrderPdfStatus = "generating";
        await canceledOrder.save();
        result = await canceledOrder.generateCanceledOrderPDF();
        break;

      case "order-tickets":
        console.log(`🎫 Generating tickets PDF for order ${orderId}`);
        const ticketsOrder = await OrderModel.findById(orderId);
        if (!ticketsOrder) {
          throw new Error(`Order ${orderId} not found`);
        }
        // Update status to generating before processing
        ticketsOrder.ticketsPdfStatus = "generating";
        await ticketsOrder.save();
        result = await ticketsOrder.generateTicketsPDFSync();
        // After successful generation, create a tickets-generated notification so the email gets sent
        try {
          if (sendNotification) {
            let notification = null;
            if (result?.populatedOrder) {
              notification = await TicketModel.createNotification(
                result.populatedOrder,
                "tickets-generated"
              );
            } else {
              // Fallback: minimally populate order for notification
              const freshOrder = await OrderModel.findById(orderId).populate([
                { path: "member" },
                { path: "event" },
                { path: "organization" },
              ]);
              if (freshOrder) {
                notification = await TicketModel.createNotification(
                  freshOrder,
                  "tickets-generated"
                );
              }
            }

            // Update order notification status
            if (notification && notification._id) {
              await OrderModel.findByIdAndUpdate(orderId, {
                $push: { notifications: notification._id },
                $set: {
                  ticketsNotificationStatus: "generated",
                  ticketsNotificationError: null,
                },
              });
            }
          }
        } catch (notifyErr) {
          console.error(
            "Failed to create tickets-generated notification:",
            notifyErr
          );
          try {
            await OrderModel.findByIdAndUpdate(orderId, {
              $set: {
                ticketsNotificationStatus: "failed",
                ticketsNotificationError: notifyErr.message,
              },
            });
          } catch (_) {}
        }
        break;

      case "single-ticket":
        console.log(`🎫 Generating PDF for ticket ${ticketId}`);
        const ticket = await TicketModel.findById(ticketId);
        if (!ticket) {
          throw new Error(`Ticket ${ticketId} not found`);
        }
        // Update status to generating before processing
        ticket.ticketPdfStatus = "generating";
        await ticket.save();
        result = await ticket.generatePDFSync();
        break;

      default:
        throw new Error(`Unknown PDF generation type: ${type}`);
    }

    console.log(
      `✅ PDF generation completed for ${type}: ${orderId || ticketId}`
    );

    return {
      success: true,
      type,
      id: orderId || ticketId,
      url: result?.url || result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      `❌ PDF generation failed for ${type} ${orderId || ticketId}:`,
      error
    );

    // Update the relevant model with failure status
    try {
      if (orderId) {
        const order = await OrderModel.findById(orderId);
        if (order) {
          if (type === "order-receipt") {
            order.receiptPdfStatus = "failed";
            order.receiptPdfError = error.message;
          } else if (type === "order-tickets") {
            order.ticketsPdfStatus = "failed";
            order.ticketsPdfError = error.message;
          } else if (type === "order-cancelled") {
            order.canceledOrderPdfStatus = "failed";
            order.canceledOrderPdfError = error.message;
          }
          await order.save();
        }
      } else if (ticketId) {
        const ticket = await TicketModel.findById(ticketId);
        if (ticket) {
          ticket.ticketPdfStatus = "failed";
          ticket.ticketPdfError = error.message;
          await ticket.save();
        }
      }
    } catch (updateError) {
      console.error("Failed to update model with error status:", updateError);
    }

    // Send error alert email
    await sendPdfErrorAlert(error, job.data);

    throw error;
  }
};

/**
 * Initialize PDF generation worker
 */
const initPdfWorker = () => {
  console.log("🎨 Initializing PDF generation worker...");

  // Process PDF generation jobs with concurrency
  // Increased concurrency since we use pages (not browsers) and have delayed recycling
  queues.pdfGeneration.process("generate-pdf", 5, processPdfGeneration);

  // Catch-all processor for legacy/unnamed jobs
  queues.pdfGeneration.process(5, processPdfGeneration);

  // Handle job completion
  queues.pdfGeneration.on("completed", (job, result) => {
    console.log(
      `✅ PDF job completed: ${job.data.type} for ${
        job.data.orderId || job.data.ticketId
      }`
    );
  });

  // Handle job failure
  queues.pdfGeneration.on("failed", (job, err) => {
    console.error(
      `❌ PDF job failed: ${job.data.type} for ${
        job.data.orderId || job.data.ticketId
      }`,
      err.message
    );
  });

  // Handle job stalled
  queues.pdfGeneration.on("stalled", (jobId) => {
    console.warn(`⚠️ PDF job stalled: ${jobId}`);
  });

  // Handle stalled job recovery
  queues.pdfGeneration.on("stalled", async (jobId) => {
    console.log(`🔄 Attempting to recover stalled PDF job: ${jobId}`);
    try {
      const job = await queues.pdfGeneration.getJob(jobId);
      if (job) {
        await job.retry();
        console.log(`✅ Retried stalled PDF job: ${jobId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to retry stalled PDF job ${jobId}:`, error);
    }
  });

  // Log when worker starts processing
  queues.pdfGeneration.on("active", (job) => {
    console.log(
      `🔄 PDF worker processing job ${job.id}: ${job.data.type} for ${
        job.data.orderId || job.data.ticketId
      }`
    );
  });

  console.log("✅ PDF generation worker initialized");
};

/**
 * Add PDF generation job to queue
 */
const enqueuePdfGeneration = async (type, data) => {
  console.log(`📋 Enqueuing PDF generation job: ${type}`);

  // Ensure queue connection is ready
  await ensureQueueReady(queues.pdfGeneration, "pdfGeneration");

  const jobData = {
    type,
    ...data,
    enqueuedAt: new Date().toISOString(),
  };

  const job = await queues.pdfGeneration.add("generate-pdf", jobData, {
    priority: getJobPriority(type),
    delay: getJobDelay(type),
  });

  console.log(`📋 PDF generation job enqueued: ${job.id} (${type})`);

  return job;
};

/**
 * Get job priority based on type
 */
const getJobPriority = (type) => {
  const priorities = {
    "order-receipt": 5, // High priority for receipts
    "order-tickets": 4, // High priority for tickets
    "order-cancelled": 3, // Medium priority for cancellations
    "single-ticket": 2, // Lower priority for single tickets
  };

  return priorities[type] || 1;
};

/**
 * Get job delay based on type
 */
const getJobDelay = (type) => {
  // Add small delay to prevent overwhelming the system
  const delays = {
    "order-receipt": 100, // 100ms delay
    "order-tickets": 200, // 200ms delay
    "order-cancelled": 50, // 50ms delay
    "single-ticket": 300, // 300ms delay
  };

  return delays[type] || 0;
};

module.exports = {
  initPdfWorker,
  enqueuePdfGeneration,
  processPdfGeneration,
  sendPdfErrorAlert,
};
