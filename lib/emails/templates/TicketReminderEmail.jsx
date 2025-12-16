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
  Button,
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

function formatTime(time) {
  if (!time) return "";
  const [h, m] = String(time)
    .split(":")
    .map((n) => parseInt(n, 10));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function TicketReminderEmail(props) {
  const {
    event = {},
    order = {},
    organization = {},
    member = {},
    env = {},
  } = props || {};
  const previewText = `Event Reminder - ${event.title || "Event"}`;
  const host = env.SCALE_COM_HOST || "https://kikits.com";

  const addressLine =
    event?.location?.address ||
    event?.location?.address1 ||
    event?.location?.formattedAddress ||
    "";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body
          style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            lineHeight: "1.6",
            color: "#111",
            margin: "0",
            padding: "0",
            backgroundColor: "#ffffff",
          }}
        >
          <Container
            style={{
              maxWidth: "700px",
              margin: "40px auto",
              backgroundColor: "#ffffff",
              border: "1px solid #ddd",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <Section
              style={{
                backgroundColor: "#ff6b00",
                color: "#fff",
                textAlign: "center",
                padding: "20px 20px 10px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <svg
                  style={{
                    height: "32px",
                    width: "32px",
                    stroke: "currentColor",
                    fill: "currentColor",
                    strokeWidth: "0",
                    viewBox: "0 0 512 512",
                    display: "inline-block",
                    verticalAlign: "middle",
                    marginRight: "12px",
                  }}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="none"
                    stroke="#ffffff"
                    strokeMiterlimit="10"
                    strokeWidth="32"
                    d="M366.05 146a46.7 46.7 0 0 1-2.42-63.42 3.87 3.87 0 0 0-.22-5.26l-44.13-44.18a3.89 3.89 0 0 0-5.5 0l-70.34 70.34a23.62 23.62 0 0 0-5.71 9.24 23.66 23.66 0 0 1-14.95 15 23.7 23.7 0 0 0-9.25 5.71L33.14 313.78a3.89 3.89 0 0 0 0 5.5l44.13 44.13a3.87 3.87 0 0 0 5.26.22 46.69 46.69 0 0 1 65.84 65.84 3.87 3.87 0 0 0 .22 5.26l44.13 44.13a3.89 3.89 0 0 0 5.5 0l180.4-180.39a23.7 23.7 0 0 0 5.71-9.25 23.66 23.66 0 0 1 14.95-15 23.62 23.62 0 0 0 9.24-5.71l70.34-70.34a3.89 3.89 0 0 0 0-5.5l-44.13-44.13a3.87 3.87 0 0 0-5.26-.22 46.7 46.7 0 0 1-63.42-2.32z"
                  />
                  <path
                    fill="none"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeMiterlimit="10"
                    strokeWidth="32"
                    d="m250.5 140.44-16.51-16.51m60.53 60.53-11.01-11m55.03 55.03-11-11.01m60.53 60.53-16.51-16.51"
                  />
                </svg>
                <span
                  style={{
                    fontFamily: "'Inter', Arial, sans-serif",
                    fontWeight: "800",
                    fontStyle: "italic",
                    textTransform: "lowercase",
                    fontSize: "1.8em",
                    color: "white",
                    verticalAlign: "middle",
                  }}
                >
                  KIKITS
                </span>
              </div>
              <Heading
                style={{
                  margin: "0",
                  fontSize: "20px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Event Reminder - Tomorrow!
              </Heading>
            </Section>

            {/* Main Content */}
            <Section style={{ padding: "24px 32px", color: "#111" }}>
              <Heading
                style={{
                  marginTop: "0",
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#222",
                }}
              >
                Hello {member.firstName || member.name},
              </Heading>
              <Text>
                This is a friendly reminder that your event{" "}
                <strong>{event.title}</strong> is happening{" "}
                <strong>tomorrow</strong>! We're excited to see you there.
              </Text>

              <div
                style={{
                  textAlign: "center",
                  fontSize: "22px",
                  fontWeight: "bold",
                  color: "#ff6b00",
                  margin: "24px 0",
                }}
              >
                See You Tomorrow!
              </div>

              {/* Event Details */}
              <div
                style={{
                  backgroundColor: "#f9f9f9",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  padding: "16px",
                  color: "#111",
                }}
              >
                <Heading
                  style={{
                    marginTop: "0",
                    fontSize: "15px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    color: "#333",
                  }}
                >
                  Event Details
                </Heading>
                <Text style={{ margin: "6px 0", fontSize: "14px" }}>
                  <strong style={{ color: "#000" }}>Event:</strong>{" "}
                  {event.title}
                </Text>
                <Text style={{ margin: "6px 0", fontSize: "14px" }}>
                  <strong style={{ color: "#000" }}>Date:</strong>{" "}
                  {formatDate(event.startDate)}
                </Text>
                {event.startTime ? (
                  <Text style={{ margin: "6px 0", fontSize: "14px" }}>
                    <strong style={{ color: "#000" }}>Time:</strong>{" "}
                    {formatTime(event.startTime)}
                    {event.endTime ? ` – ${formatTime(event.endTime)}` : ""}
                  </Text>
                ) : null}
                {event.location ? (
                  <Text style={{ margin: "6px 0", fontSize: "14px" }}>
                    <strong style={{ color: "#000" }}>Location:</strong>{" "}
                    {event.location.name}
                    {addressLine ? `, ${addressLine}` : ""}
                  </Text>
                ) : null}
              </div>

              <div style={{ borderTop: "2px dashed #ddd", margin: "20px 0" }} />

              {/* Quick Reminders */}
              <div
                style={{
                  backgroundColor: "#fff8f1",
                  border: "1px dashed #ffb57d",
                  borderRadius: "6px",
                  padding: "16px",
                  margin: "24px 0",
                  fontSize: "14px",
                  color: "#333",
                }}
              >
                <strong style={{ color: "#000" }}>Quick Reminders:</strong>
                <ul style={{ margin: "10px 0 0 20px", padding: "0" }}>
                  <li>
                    Make sure to bring your tickets (printed or on your device)
                  </li>
                  <li>Plan to arrive 15-30 minutes before the event starts</li>
                  <li>Check traffic and parking information ahead of time</li>
                  {order?.ticketsPdfUrl ? (
                    <li>
                      <a
                        href={order.ticketsPdfUrl}
                        style={{ color: "#ff6b00", textDecoration: "none" }}
                      >
                        Download your tickets here
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>

              {/* Action Buttons */}
              <table
                cellPadding="0"
                cellSpacing="0"
                border={0}
                style={{ margin: "28px auto", width: "80%" }}
              >
                <tbody>
                  <tr>
                    {order?.ticketsPdfUrl ? (
                      <td style={{ textAlign: "center", padding: "0 6px" }}>
                        <Button
                          href={order.ticketsPdfUrl}
                          style={{
                            display: "inline-block",
                            padding: "12px 24px",
                            backgroundColor: "#ff6b00",
                            color: "#fff",
                            textDecoration: "none",
                            textAlign: "center",
                            textTransform: "uppercase",
                            fontWeight: "bold",
                            borderRadius: "4px",
                            letterSpacing: "0.5px",
                            fontSize: "14px",
                          }}
                        >
                          Download Tickets
                        </Button>
                      </td>
                    ) : null}
                    <td style={{ textAlign: "center", padding: "0 6px" }}>
                      <Button
                        href={`${host}/apple-wallet?orderId=${
                          order?._id || ""
                        }`}
                        style={{
                          display: "inline-block",
                          padding: "12px 24px",
                          backgroundColor: "#007aff",
                          color: "#fff",
                          textDecoration: "none",
                          textAlign: "center",
                          textTransform: "uppercase",
                          fontWeight: "bold",
                          borderRadius: "4px",
                          letterSpacing: "0.5px",
                          fontSize: "14px",
                        }}
                      >
                        Add to Wallet
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Event Description */}
              {event?.description ? (
                <div style={{ marginTop: "20px" }}>
                  <Heading
                    style={{
                      fontSize: "14px",
                      textTransform: "uppercase",
                      color: "#000",
                      letterSpacing: "0.5px",
                    }}
                  >
                    About This Event
                  </Heading>
                  <Text style={{ color: "#444", fontSize: "14px" }}>
                    {event.description}
                  </Text>
                </div>
              ) : null}

              <div style={{ marginTop: "24px", textAlign: "center" }}>
                <Text style={{ color: "#666", fontSize: "14px", margin: "0" }}>
                  We can't wait to see you tomorrow! If you have any questions,
                  please don't hesitate to contact us.
                </Text>
              </div>
            </Section>

            {/* Footer */}
            <Section
              style={{
                textAlign: "center",
                padding: "20px",
                color: "#888",
                fontSize: "12px",
                borderTop: "1px dashed #ddd",
                backgroundColor: "#fff",
              }}
            >
              <Text style={{ margin: "6px 0" }}>© Kikits</Text>
              {organization?.name ? (
                <Text style={{ margin: "6px 0" }}>{organization.name}</Text>
              ) : null}
              <Text style={{ margin: "6px 0" }}>
                This is an automated reminder for your upcoming event.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

module.exports = {
  TicketReminderEmail,
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
    "member",
  ],
};
