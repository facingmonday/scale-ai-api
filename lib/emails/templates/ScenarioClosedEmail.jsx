const React = require("react");
const {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} = require("@react-email/components");

function ScenarioClosedEmail(props) {
  const {
    scenario = {},
    classroom = {},
    member = {},
    organization = {},
    link,
    env = {},
  } = props || {};

  const host =
    env?.SCALE_ADMIN_HOST || env?.SCALE_API_HOST || "https://scale.ai";
  const scenarioId = scenario?._id || scenario?.id || "scenario";
  const classroomId =
    classroom?._id || classroom?.id || classroom?.slug || "classroom";
  const scenarioLink =
    link ||
    scenario?.link ||
    `${host}/class/${encodeURIComponent(classroomId)}/scenario/${encodeURIComponent(scenarioId)}`;

  const scenarioTitle = scenario?.title || "Scenario results";
  const classroomName = classroom?.name || "your class";
  const memberName = member?.firstName || member?.name || "Student";
  const organizationName = organization?.name;
  const previewText = `Scenario Results Available - ${scenarioTitle}`;

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
                backgroundColor: "#4f46e5",
                color: "#fff",
                textAlign: "center",
                padding: "20px 20px 10px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ margin: "0 auto" }}
                >
                  <path
                    d="M12 2L2 7L12 12L22 7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M2 17L12 22L22 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M2 12L12 17L22 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              <Heading
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#fff",
                }}
              >
                Scenario Results Available
              </Heading>
            </Section>

            {/* Content */}
            <Section style={{ padding: "30px" }}>
              {/* Greeting */}
              <Text style={{ fontSize: "16px", marginBottom: "20px" }}>
                Hello {memberName},
              </Text>

              {/* Main Message */}
              <Text
                style={{
                  fontSize: "15px",
                  color: "#333",
                  marginBottom: "20px",
                }}
              >
                Results are now available for a scenario in{" "}
                <strong>{classroomName || "your class"}</strong>:
              </Text>

              {/* Scenario Card */}
              <div
                style={{
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #e9ecef",
                  borderRadius: "8px",
                  padding: "20px",
                  margin: "20px 0",
                }}
              >
                <Heading
                  style={{
                    marginTop: "0",
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: "#000",
                    marginBottom: "10px",
                  }}
                >
                  {scenarioTitle}
                </Heading>

                {scenario?.week ? (
                  <Text
                    style={{ margin: "6px 0", fontSize: "14px", color: "#666" }}
                  >
                    <strong style={{ color: "#000" }}>Week:</strong>{" "}
                    {scenario.week}
                  </Text>
                ) : null}

                {scenario?.description ? (
                  <Text
                    style={{
                      margin: "12px 0 0 0",
                      fontSize: "14px",
                      color: "#444",
                      lineHeight: "1.6",
                    }}
                  >
                    {scenario.description}
                  </Text>
                ) : null}
              </div>

              {/* Call to Action Button */}
              {scenarioLink ? (
                <table
                  cellPadding="0"
                  cellSpacing="0"
                  border={0}
                  style={{
                    margin: "28px auto",
                    width: "100%",
                    maxWidth: "280px",
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ textAlign: "center" }}>
                        <Button
                          href={scenarioLink}
                          style={{
                            display: "inline-block",
                            padding: "14px 28px",
                            backgroundColor: "#4f46e5",
                            color: "#fff",
                            textDecoration: "none",
                            textAlign: "center",
                            textTransform: "uppercase",
                            fontWeight: "bold",
                            borderRadius: "5px",
                            letterSpacing: "1px",
                            fontSize: "14px",
                          }}
                        >
                          View Outcome
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : null}

              {/* Important Notice */}
              <div
                style={{
                  backgroundColor: "#f0f9ff",
                  border: "1px dashed #7dd3fc",
                  borderRadius: "6px",
                  padding: "16px",
                  margin: "24px 0",
                  fontSize: "14px",
                  color: "#333",
                }}
              >
                <strong style={{ color: "#000" }}>Next Steps</strong>
                <Text style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
                  Review your results and see how your decisions impacted your
                  business performance.
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
              <Text style={{ margin: "6px 0" }}>© SCALE.ai</Text>
              {organizationName ? (
                <Text style={{ margin: "6px 0" }}>{organizationName}</Text>
              ) : null}
              {classroomName ? (
                <Text style={{ margin: "6px 0" }}>{classroomName}</Text>
              ) : null}
              <Text style={{ margin: "6px 0" }}>
                If you didn't expect this notification, you can safely ignore
                this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

module.exports = {
  ScenarioClosedEmail,
  populatePaths: ["scenario", "classroom", "member", "ledger"],
};
