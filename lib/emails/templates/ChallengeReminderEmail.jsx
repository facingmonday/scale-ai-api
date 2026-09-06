const React = require("react");
const {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
} = require("@react-email/components");

function ChallengeReminderEmail({
  challenge = {},
  classroom = {},
  deadline,
  timezone,
  link,
  announcement = false,
}) {
  return (
    <Html>
      <Head />
      <Preview>
        {announcement
          ? "A challenge is available"
          : "Remember to submit your decisions"}
        : {challenge.title}
      </Preview>
      <Body
        style={{
          backgroundColor: "#f6f7fb",
          fontFamily: "Arial, sans-serif",
          color: "#172033",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "32px auto",
            padding: "32px",
            maxWidth: "600px",
            borderRadius: "12px",
          }}
        >
          <Text style={{ color: "#4f46e5", fontWeight: "bold" }}>
            SCALE · {classroom.name}
          </Text>
          <Heading>
            {announcement
              ? "Your challenge is available"
              : "Your decisions are still needed"}
          </Heading>
          <Text>
            {announcement
              ? "Review the challenge"
              : "You have not submitted your decisions for"}{" "}
            <strong>{challenge.title}</strong>.
          </Text>
          {deadline && (
            <Text>
              <strong>Submission deadline:</strong> {deadline} ({timezone})
            </Text>
          )}
          <Text>
            {announcement
              ? "Open the challenge to review the details and your submission."
              : "Open the challenge and submit your decisions while submissions are available."}
          </Text>
          <Button
            href={link}
            style={{
              backgroundColor: "#4f46e5",
              color: "#ffffff",
              borderRadius: "6px",
              padding: "14px 22px",
            }}
          >
            Open challenge
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
function ChallengeAnnouncementEmail(props) {
  return <ChallengeReminderEmail {...props} announcement />;
}
module.exports = { ChallengeReminderEmail, ChallengeAnnouncementEmail };
