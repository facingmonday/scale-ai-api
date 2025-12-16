const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const OrderModel = require("../../order/order.model");
const { clerkClient } = require("@clerk/express");
const CartModel = require("../../carts/carts.model");

exports.handleWebhook = async (req, res) => {
  try {
    const event = req.stripeEvent;

    console.log(
      "Received webhook:",
      event.type,
      event.id,
      event.data.object.id
    );

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("Checkout session completed:", session.id);

        if (session.status === "complete") {
          let mainProcessingSuccess = false;
          let processingError = null;

          try {
            // For webhook calls, we might not have req.user
            // Check if we have a cart ID in the metadata
            if (session.metadata && session.metadata.cartId) {
              console.log(
                "Found cart ID in metadata:",
                session.metadata.cartId
              );

              // Get the ticket cart with proper population to match checkoutComplete
              const cart = await CartModel.findById(
                session.metadata.cartId
              ).populate([
                {
                  path: "event",
                },
                {
                  path: "organization",
                },
                {
                  path: "tickets.ticketType",
                },
                {
                  path: "tickets.selectedOptions",
                  populate: {
                    path: "ticketTypeOption",
                  },
                },
              ]);

              if (!cart) {
                throw new Error(
                  `No cart found with ID: ${session.metadata.cartId}`
                );
              }

              if (cart.status !== "pending") {
                console.log(
                  `Cart ${cart._id} is not pending (status: ${cart.status}), already processed`
                );
                // Return 200 since cart has already been processed
                return res
                  .status(200)
                  .json({ received: true, message: "Cart already processed" });
              }

              // Update cart status to processing and save to trigger calculateTotals
              cart.status = "processing";
              cart.stripeCheckoutSessionId = session.id;
              await cart.save(); // This will trigger calculateTotals automatically

              // Handle guest checkout - find or create member if not already set
              if (!cart.member) {
                await cart.findOrCreateMember();
                await cart.save();
              }
              console.log("Processing checkout for member: ", cart.member);
              const checkoutResult = await OrderModel.processCheckout(
                session,
                cart
              );

              // Update cart status to completed
              cart.status = "completed";
              await cart.save();

              // Check if main processing was successful
              if (checkoutResult.success) {
                mainProcessingSuccess = true;
                console.log(
                  `Successfully created Order with ${
                    checkoutResult.order?.lineItems?.length || 0
                  } line items for checkout session ${session.id}`
                );
              } else {
                processingError = checkoutResult.error;
                console.error(
                  `Error processing checkout session ${session.id}:`,
                  checkoutResult.error
                );
              }
            } else {
              throw new Error("No cart ID found in session metadata");
            }
          } catch (mainError) {
            processingError = mainError;
            console.error("Main event processing error:", mainError);
          }

          // If main processing was successful, clear any secondary errors and proceed
          if (mainProcessingSuccess) {
            console.log(
              `Event ${event.id} processed successfully, clearing any secondary errors`
            );
            // Don't throw here - main processing succeeded
          } else if (processingError) {
            // Only fail if main processing failed
            throw processingError;
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log("PaymentIntent succeeded:", paymentIntent.id);

        // If the payment intent has a transfer_data.destination, it means this is for a connected account
        if (
          paymentIntent.transfer_data &&
          paymentIntent.transfer_data.destination
        ) {
          console.log(
            `Payment will be transferred to connected account: ${paymentIntent.transfer_data.destination}`
          );
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        console.log("Charge refunded:", charge.id);

        try {
          // Find order by payment intent ID
          const paymentIntentId = charge.payment_intent;
          if (!paymentIntentId) {
            console.log("No payment_intent found on charge, skipping");
            break;
          }

          const order = await OrderModel.findOne({
            "payment.paymentIntentId": paymentIntentId,
          }).populate("organization");

          if (!order) {
            console.log(
              `No order found for payment intent ${paymentIntentId}, skipping`
            );
            break;
          }

          // Get refund details from charge
          const amountRefunded = charge.amount_refunded || 0;
          const orderAmount = order.payment?.amount || order.total || 0;

          // Determine refund status
          let refundStatus = null;
          if (amountRefunded >= orderAmount) {
            refundStatus = "refunded";
          } else if (amountRefunded > 0) {
            refundStatus = "partially_refunded";
          }

          // Get refund objects from charge
          const refunds = charge.refunds?.data || [];
          const refundData = refunds.map((refund) => ({
            id: refund.id,
            amount: refund.amount,
            currency: refund.currency,
            status: refund.status,
            created: new Date(refund.created * 1000).toISOString(),
            reason: refund.reason,
            balance_transaction: refund.balance_transaction,
          }));

          // Update order payment metadata
          if (!order.payment.refunds) {
            order.payment.refunds = [];
          }

          // Merge new refunds (avoid duplicates)
          for (const refund of refundData) {
            const exists = order.payment.refunds.some(
              (r) => r.id === refund.id
            );
            if (!exists) {
              order.payment.refunds.push(refund);
            }
          }

          // Update order status and payment status
          const updateData = {
            payment: order.payment,
            updatedDate: new Date(),
          };

          if (refundStatus) {
            updateData.status = refundStatus;
            updateData.payment.paymentStatus = refundStatus;
          }

          await OrderModel.findByIdAndUpdate(order._id, updateData);

          // Update ticket payment status if full refund
          if (refundStatus === "refunded") {
            const TicketModel = require("../../tickets/tickets.model");
            await TicketModel.updateMany(
              { order: order._id },
              {
                paymentStatus: "refunded",
                updatedDate: new Date(),
              }
            );
          }

          console.log(
            `✅ Updated order ${order._id} with refund status: ${refundStatus}`
          );
        } catch (refundError) {
          console.error(
            "Error processing charge.refunded webhook:",
            refundError
          );
          // Don't throw - we want to acknowledge the webhook
        }
        break;
      }

      case "refund.created":
      case "refund.updated": {
        const refund = event.data.object;
        console.log(`Refund ${event.type}:`, refund.id);

        try {
          // Find order by payment intent (refunds created via payment_intent should have this)
          let order = null;

          if (refund.payment_intent) {
            order = await OrderModel.findOne({
              "payment.paymentIntentId": refund.payment_intent,
            });
          } else if (refund.charge) {
            // Fallback: search for order with matching charge
            // Note: This is less reliable but handles edge cases
            // We'll search orders and check their payment intents' charges
            console.log(
              `Refund ${refund.id} has charge but no payment_intent, attempting lookup by charge`
            );
            // For now, log and skip - in production you might want to implement
            // a more sophisticated lookup, but refunds via payment_intent should
            // always have payment_intent field
            console.log(
              `Skipping refund ${refund.id} - no payment_intent field (charge: ${refund.charge})`
            );
            break;
          }

          if (!order) {
            console.log(`No order found for refund ${refund.id}, skipping`);
            break;
          }

          // Create refund data object
          const refundData = {
            id: refund.id,
            amount: refund.amount,
            currency: refund.currency,
            status: refund.status,
            created: new Date(refund.created * 1000).toISOString(),
            reason: refund.reason,
            balance_transaction: refund.balance_transaction,
          };

          // Update order payment metadata
          if (!order.payment.refunds) {
            order.payment.refunds = [];
          }

          // Update or add refund
          const existingIndex = order.payment.refunds.findIndex(
            (r) => r.id === refund.id
          );
          if (existingIndex >= 0) {
            order.payment.refunds[existingIndex] = refundData;
          } else {
            order.payment.refunds.push(refundData);
          }

          // Calculate total refunded amount
          const totalRefunded = order.payment.refunds.reduce(
            (sum, r) => sum + (r.amount || 0),
            0
          );
          const orderAmount = order.payment?.amount || order.total || 0;

          // Determine refund status
          let refundStatus = null;
          if (totalRefunded >= orderAmount) {
            refundStatus = "refunded";
          } else if (totalRefunded > 0) {
            refundStatus = "partially_refunded";
          }

          // Update order
          const updateData = {
            payment: order.payment,
            updatedDate: new Date(),
          };

          if (refundStatus) {
            updateData.status = refundStatus;
            updateData.payment.paymentStatus = refundStatus;
          }

          await OrderModel.findByIdAndUpdate(order._id, updateData);

          // Update ticket payment status if full refund
          if (refundStatus === "refunded") {
            const TicketModel = require("../../tickets/tickets.model");
            await TicketModel.updateMany(
              { order: order._id },
              {
                paymentStatus: "refunded",
                updatedDate: new Date(),
              }
            );
          }

          console.log(
            `✅ Updated order ${order._id} with refund ${refund.id} (status: ${refund.status})`
          );
        } catch (refundError) {
          console.error(`Error processing ${event.type} webhook:`, refundError);
          // Don't throw - we want to acknowledge the webhook
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (err) {
    console.log(err);
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};
