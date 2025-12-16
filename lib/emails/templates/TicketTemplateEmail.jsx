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
  Img,
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

function TicketTemplateEmail(props) {
  const { event = {}, tickets = [] } = props || {};
  const previewText = `Event Ticket - ${event.title || "Event"}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="font-sans bg-white text-black m-0">
          {Array.isArray(tickets)
            ? tickets.map((t, i) => (
                <Container
                  key={i}
                  style={{
                    width: "100%",
                    minWidth: "100%",
                    maxWidth: "100%",
                    margin: "0 auto 40px auto",
                    background: "#fff",
                    padding: "24px",
                    pageBreakAfter: "always",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Brand header */}
                  <Section
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "20px",
                    }}
                  >
                    <svg
                      className="brand-logo"
                      style={{ height: 32, width: 32 }}
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
                      ></path>
                      <path
                        fill="none"
                        stroke="#ff6b00"
                        strokeLinecap="round"
                        strokeMiterlimit="10"
                        strokeWidth="32"
                        d="m250.5 140.44-16.51-16.51m60.53 60.53-11.01-11m55.03 55.03-11-11.01m60.53 60.53-16.51-16.51"
                      ></path>
                    </svg>
                    <span
                      style={{
                        fontFamily: '"Inter", sans-serif',
                        fontWeight: 800,
                        fontStyle: "italic",
                        textTransform: "lowercase",
                        fontSize: "1.8em",
                        color: "#ff6b00",
                      }}
                    >
                      KIKITS
                    </span>
                  </Section>

                  {/* Ticket card */}
                  <table
                    align="center"
                    width="100%"
                    border="0"
                    cellPadding="0"
                    cellSpacing="0"
                    role="presentation"
                    style={{
                      border: "2px solid #ff6b00",
                      borderRadius: "8px",
                      padding: "20px",
                      width: "100%",
                      height: "fit-content",
                      minHeight: "400px", // Ensure enough space for absolutely positioned content
                      minWidth: "100%",
                      position: "relative",
                    }}
                  >
                    <tbody>
                      <tr>
                        <td valign="top">
                          {/* Left content */}
                          <div
                            style={{
                              width: "100%",
                              minWidth: 0,
                              alignSelf: "flex-start",
                            }}
                          >
                            <Heading
                              style={{
                                fontSize: "24px",
                                fontWeight: "bold",
                                color: "#ff6b00",
                                marginBottom: "15px",
                              }}
                            >
                              {event.title}
                            </Heading>

                            {/* Date & Time */}
                            <div style={{ marginBottom: "12px" }}>
                              <Text
                                style={{
                                  fontSize: "15px",
                                  color: "#000",
                                  fontWeight: 500,
                                  lineHeight: 1.4,
                                }}
                              >
                                {formatDate(event.startDate)}
                                {event.startTime
                                  ? `, ${formatTime(event.startTime)}`
                                  : ""}
                              </Text>
                            </div>

                            {/* Location */}
                            {event?.location ? (
                              <div style={{ marginBottom: "12px" }}>
                                <Text
                                  style={{
                                    fontSize: "15px",
                                    color: "#000",
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {event.location.name}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: "15px",
                                    color: "#000",
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {event.location.address1},{" "}
                                  {event.location.city}, {event.location.state}{" "}
                                  {event.location.zip}
                                </Text>
                              </div>
                            ) : null}

                            {/* Ticket type and price */}
                            <div style={{ marginBottom: "12px" }}>
                              <div style={{ display: "flex", gap: "20px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <span
                                    style={{ color: "#666", fontSize: "14px" }}
                                  >
                                    Type:
                                  </span>
                                  <span style={{ fontWeight: 600 }}>
                                    {t?.ticketType?.name
                                      ? t.ticketType.name
                                          .charAt(0)
                                          .toUpperCase() +
                                        t.ticketType.name.slice(1)
                                      : ""}
                                  </span>
                                </div>
                                {typeof t?.price === "number" ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "#666",
                                        fontSize: "14px",
                                      }}
                                    >
                                      Price:
                                    </span>
                                    <span style={{ fontWeight: 600 }}>
                                      ${(t.price / 100).toFixed(2)}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {/* Attendee */}
                            {t?.attendeeInfo?.name ? (
                              <div style={{ marginBottom: "12px" }}>
                                <Text
                                  style={{
                                    fontSize: "13px",
                                    color: "#666",
                                  }}
                                >
                                  Attendee:{" "}
                                  <span
                                    style={{
                                      fontSize: "15px",
                                      fontWeight: 600,
                                      color: "#000",
                                    }}
                                  >
                                    {t.attendeeInfo.name}
                                  </span>
                                </Text>
                              </div>
                            ) : null}

                            {/* Selected options */}
                            {Array.isArray(t?.formattedOptions) &&
                            t.formattedOptions.length > 0 ? (
                              <div
                                style={{
                                  borderTop: "1px solid #eee",
                                  maxWidth: "calc(100% - 160px)", // Don't extend into right column space
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: "15px",
                                    fontWeight: 600,
                                    color: "#ff6b00",
                                    marginBottom: "4px",
                                  }}
                                >
                                  Selected Options
                                </Text>
                                <Text
                                  style={{ fontSize: "13px", color: "#333" }}
                                >
                                  {t.formattedOptions.map((opt, idx) => (
                                    <span key={idx}>
                                      {opt.name}:{" "}
                                      {opt.type === "boolean"
                                        ? opt.value
                                          ? "Yes"
                                          : "No"
                                        : opt.value}
                                      {idx < t.formattedOptions.length - 1
                                        ? ", "
                                        : ""}
                                    </span>
                                  ))}
                                </Text>
                              </div>
                            ) : null}
                          </div>

                          {/* Right column: image + QR */}
                          <div
                            style={{
                              position: "absolute",
                              top: "20px",
                              right: "20px", // Align with container padding
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              // paddingTop: "20px",
                              paddingBottom: "16px",
                              minWidth: "140px",
                            }}
                          >
                            {event?.defaultImage?.url ? (
                              <Img
                                src={event.defaultImage.url}
                                alt="Event Image"
                                style={{
                                  width: "130px",
                                  height: "130px",
                                  objectFit: "cover",
                                  borderRadius: "8px",
                                  marginBottom: "20px",
                                }}
                              />
                            ) : event?.location?.defaultImage?.url ? (
                              <Img
                                src={event.location.defaultImage.url}
                                alt="Location Image"
                                style={{
                                  width: "130px",
                                  height: "130px",
                                  objectFit: "cover",
                                  borderRadius: "8px",
                                  marginBottom: "20px",
                                }}
                              />
                            ) : null}

                            {t?.qrCodeDataUrl ? (
                              <div
                                style={{
                                  width: "130px",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  flexShrink: 0,
                                  marginBottom: "20px",
                                  paddingBottom: "16px",
                                }}
                              >
                                <Img
                                  src={t.qrCodeDataUrl}
                                  alt="Ticket QR Code"
                                  style={{
                                    width: "120px",
                                    height: "120px",
                                    background: "#fff",
                                    padding: "4px",
                                    border: "1px solid #ddd",
                                    borderRadius: "8px",
                                  }}
                                />
                                <Text
                                  style={{
                                    textAlign: "center",
                                    fontSize: "13px",
                                    color: "#666",
                                    marginBottom: "16px",
                                  }}
                                >
                                  {t.ticketNumber}
                                </Text>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Container>
              ))
            : null}
        </Body>
      </Tailwind>
    </Html>
  );
}

module.exports = {
  TicketTemplateEmail,
  populatePaths: [
    "event.location",
    "event.defaultImage",
    "event.category",
    "member",
    "order.lineItems.tickets.ticketType",
    "order.lineItems.tickets.selectedOptions.ticketTypeOption.ticketTypeOptionValues.ticketTypeOptionValue.ticketTypeOptionValueValues",
  ],
};
