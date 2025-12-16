const React = require("react");
const {
  Html,
  Head,
  Preview,
  Tailwind,
  Body,
  Container,
  Heading,
  Section,
  Text,
} = require("@react-email/components");

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function capitalize(str) {
  if (!str) return "";
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

function OrderCancelledEmail(props) {
  const {
    order = {},
    event = {},
    organization = {},
    member = {},
  } = props || {};
  const previewText = `Order Cancelled - ${String(order._id) || "Order"}`;

  const ticketsCount = Array.isArray(order?.lineItems)
    ? order.lineItems.reduce((sum, li) => sum + (li?.quantity || 0), 0)
    : 0;

  return (
    <Html>
      <Head>
        <style>
          {`
            .alternate-row {
              background-color: #fafafa !important;
            }
          `}
        </style>
      </Head>
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body
          style={{
            fontFamily: "Arial, sans-serif",
            background: "#fff",
            color: "#111",
            margin: "0",
            padding: "0",
          }}
        >
          <Container
            style={{
              maxWidth: "700px",
              margin: "0 auto",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #ccc",
              padding: "32px",
            }}
          >
            {/* Header / Logo */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <svg
                className="brand-logo"
                style={{ width: "32px", height: "32px" }}
                stroke="currentColor"
                fill="currentColor"
                strokeWidth="0"
                viewBox="0 0 512 512"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill="none"
                  stroke="#ff6b00"
                  strokeMiterlimit="10"
                  strokeWidth="32"
                  d="M366.05 146a46.7 46.7 0 0 1-2.42-63.42 3.87 3.87 0 0 0-.22-5.26l-44.13-44.18a3.89 3.89 0 0 0-5.5 0l-70.34 70.34a23.62 23.62 0 0 0-5.71 9.24 23.66 23.66 0 0 1-14.95 15 23.7 23.7 0 0 0-9.25 5.71L33.14 313.78a3.89 3.89 0 0 0 0 5.5l44.13 44.13a3.87 3.87 0 0 0 5.26.22 46.69 46.69 0 0 1 65.84 65.84 3.87 3.87 0 0 0 .22 5.26l44.13 44.13a3.89 3.89 0 0 0 5.5 0l180.4-180.39a23.7 23.7 0 0 0 5.71-9.25 23.66 23.66 0 0 1 14.95-15 23.62 23.62 0 0 0 9.24-5.71l70.34-70.34a3.89 3.89 0 0 0 0-5.5l-44.13-44.13a3.87 3.87 0 0 0-5.26-.22 46.7 46.7 0 0 1-63.42-2.32z"
                />
                <path
                  fill="none"
                  stroke="#ff6b00"
                  strokeLinecap="round"
                  strokeMiterlimit="10"
                  strokeWidth="32"
                  d="m250.5 140.44-16.51-16.51m60.53 60.53-11.01-11m55.03 55.03-11-11.01m60.53 60.53-16.51-16.51"
                />
              </svg>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#ff6b00",
                }}
              >
                KIKITS
              </span>
            </div>

            <Heading
              style={{
                fontSize: "32px",
                marginBottom: "24px",
                color: "#ff6b00",
                fontWeight: "600",
              }}
            >
              Your order has been cancelled!
            </Heading>

            <Text
              style={{
                fontSize: "16px",
                lineHeight: "1.5",
                marginBottom: "32px",
                color: "#555",
              }}
            >
              Your cancellation request for #{String(order._id || "")} has been
              successfully processed. Please let us know the reason for the
              cancellation to help us improve your experience in the future.
            </Text>

            {/* Order and Event Information */}
            <div
              style={{
                marginBottom: "30px",
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <div style={{ width: "48%" }}>
                <div
                  style={{
                    fontWeight: "bold",
                    marginBottom: "12px",
                    fontSize: "16px",
                    borderBottom: "1px solid #eee",
                    paddingBottom: "4px",
                  }}
                >
                  Order Information
                </div>
                <div style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong>Order ID:</strong> {String(order._id || "")}
                </div>
                <div style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong>Date:</strong> {formatDate(order.createdDate)}
                </div>
                <div style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong>Status:</strong> {capitalize(order.status)}
                </div>
              </div>

              <div style={{ width: "48%" }}>
                <div
                  style={{
                    fontWeight: "bold",
                    marginBottom: "12px",
                    fontSize: "16px",
                    borderBottom: "1px solid #eee",
                    paddingBottom: "4px",
                  }}
                >
                  Event Information
                </div>
                <div style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong>Event:</strong> {event.title}
                </div>
                <div style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong>Tickets:</strong> {ticketsCount}
                </div>
                <div style={{ marginBottom: "8px", fontSize: "14px" }}>
                  <strong>Total:</strong> $
                  {typeof order.total === "number"
                    ? (order.total / 100).toFixed(2)
                    : order.total}
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div style={{ marginBottom: "30px" }}>
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "12px",
                  fontSize: "16px",
                  borderBottom: "1px solid #eee",
                  paddingBottom: "4px",
                }}
              >
                Customer Information
              </div>
              <div style={{ marginBottom: "8px", fontSize: "14px" }}>
                <strong>Name:</strong> {member.firstName} {member.lastName}
              </div>
              <div style={{ marginBottom: "8px", fontSize: "14px" }}>
                <strong>Email:</strong> {member.maskedEmail || member.email}
              </div>
            </div>

            {/* Cancelled Items */}
            <div style={{ marginBottom: "32px" }}>
              <Heading
                style={{
                  fontSize: "24px",
                  marginBottom: "20px",
                  color: "#ff6b00",
                  fontWeight: "600",
                }}
              >
                Cancelled Items:
              </Heading>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "16px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                        backgroundColor: "#f4f4f4",
                      }}
                    >
                      Ticket Type
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                        backgroundColor: "#f4f4f4",
                      }}
                    >
                      Quantity
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                        backgroundColor: "#f4f4f4",
                      }}
                    >
                      Unit Price
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                        backgroundColor: "#f4f4f4",
                      }}
                    >
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(order?.lineItems)
                    ? order.lineItems.map((li, idx) => (
                        <React.Fragment key={idx}>
                          <tr
                            className={idx % 2 === 1 ? "alternate-row" : ""}
                            style={{ backgroundColor: "transparent" }}
                          >
                            <td
                              style={{
                                textAlign: "left",
                                padding: "12px",
                                fontSize: "14px",
                              }}
                            >
                              {li?.ticketType?.name}
                            </td>
                            <td
                              style={{
                                textAlign: "left",
                                padding: "12px",
                                fontSize: "14px",
                              }}
                            >
                              {li?.quantity}
                            </td>
                            <td
                              style={{
                                textAlign: "left",
                                padding: "12px",
                                fontSize: "14px",
                              }}
                            >
                              $
                              {typeof li?.unitPrice === "number"
                                ? (li.unitPrice / 100).toFixed(2)
                                : li?.unitPrice}
                            </td>
                            <td
                              style={{
                                textAlign: "left",
                                padding: "12px",
                                fontSize: "14px",
                              }}
                            >
                              $
                              {typeof li?.totalPrice === "number"
                                ? (li.totalPrice / 100).toFixed(2)
                                : li?.totalPrice}
                            </td>
                          </tr>

                          {/* Ticket details */}
                          {Array.isArray(li?.tickets)
                            ? li.tickets.map((t, j) => (
                                <tr
                                  key={j}
                                  style={{
                                    backgroundColor: "#f8f8f8",
                                    fontSize: "12px",
                                    padding: "0",
                                    borderTop: "none",
                                  }}
                                >
                                  <td
                                    colSpan={4}
                                    style={{
                                      textAlign: "left",
                                      padding: "12px",
                                    }}
                                  >
                                    <div style={{ marginBottom: "2px" }}>
                                      <span
                                        style={{
                                          fontWeight: "500",
                                          color: "#666",
                                        }}
                                      >
                                        Ticket #:
                                      </span>{" "}
                                      {t?.ticketNumber}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            : null}

                          {/* Selected options */}
                          {Array.isArray(li?.selectedOptions) &&
                          li.selectedOptions.length > 0 ? (
                            <tr
                              style={{
                                backgroundColor: "#f8f8f8",
                                fontSize: "12px",
                                padding: "0",
                                borderTop: "none",
                              }}
                            >
                              <td
                                colSpan={4}
                                style={{ textAlign: "left", padding: "12px" }}
                              >
                                {li.selectedOptions.map((opt, k) => (
                                  <div key={k} style={{ marginBottom: "2px" }}>
                                    <span
                                      style={{
                                        fontWeight: "500",
                                        color: "#666",
                                      }}
                                    >
                                      Selected Option:
                                    </span>{" "}
                                    {opt?.ticketTypeOption?.name} {opt?.value}
                                  </div>
                                ))}
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      ))
                    : null}
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                        borderTop: "2px solid #ddd",
                      }}
                    >
                      Subtotal
                    </td>
                    <td
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                        borderTop: "2px solid #ddd",
                      }}
                    >
                      $
                      {typeof order?.subTotal === "number"
                        ? (order.subTotal / 100).toFixed(2)
                        : order?.subTotal}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                      }}
                    >
                      Tax
                    </td>
                    <td
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                      }}
                    >
                      $
                      {typeof order?.tax === "number"
                        ? (order.tax / 100).toFixed(2)
                        : order?.tax}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        borderTop: "1px solid #ddd",
                      }}
                    >
                      Total
                    </td>
                    <td
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        borderTop: "1px solid #ddd",
                      }}
                    >
                      $
                      {typeof order?.total === "number"
                        ? (order.total / 100).toFixed(2)
                        : order?.total}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Need Help Box */}
            <div
              style={{
                backgroundColor: "#fff9e6",
                border: "1px solid #ffd54f",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "32px",
              }}
            >
              <Text style={{ margin: "0", color: "#f57f17", fontSize: "14px" }}>
                <strong>Need Help?</strong> If you have any questions about this
                cancellation or need assistance with future orders, please don't
                hesitate to contact our customer support team.
              </Text>
            </div>

            {/* Footer */}
            <div
              style={{
                fontSize: "12px",
                color: "#666",
                borderTop: "1px solid #eee",
                marginTop: "40px",
                paddingTop: "16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "16px",
                }}
              >
                <Text style={{ margin: "0 8px" }}>© Kikits</Text>
                {organization?.name ? (
                  <Text style={{ margin: "0 8px" }}>{organization.name}</Text>
                ) : null}
              </div>
              {organization?.email ? (
                <Text style={{ margin: "0 8px" }}>
                  Contact: {organization.email}
                </Text>
              ) : null}
              <Text style={{ margin: "0 8px" }}>
                If you did not request this cancellation, please contact us
                immediately.
              </Text>
            </div>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

module.exports = {
  OrderCancelledEmail,
  populatePaths: [
    "order.lineItems.tickets",
    "order.lineItems.ticketType",
    "order.lineItems.tickets.ticketType",
    "order.lineItems.tickets.ticketType.ticketTypeOptions",
    "order.lineItems.tickets.selectedOptions",
    "order.lineItems.tickets.selectedOptions.ticketTypeOption",
    "order.lineItems.selectedOptions",
    "order.lineItems.selectedOptions.ticketTypeOption",
    "event.location",
    "event.defaultImage",
    "event.category",
    "member",
  ],
};
