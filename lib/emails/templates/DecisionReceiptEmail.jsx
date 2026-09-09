const React = require("react");
const { Html, Head, Preview, Body, Container, Heading, Text, Button, Section } = require("@react-email/components");

function displayValue(value) {
  if (value === "" || value === null || value === undefined) return "(No answer)";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
function Answers({ title, values = {}, labels = {}, scope }) {
  return <Section>
    <Heading as="h2" style={{ fontSize: "18px", marginTop: "28px" }}>{title}</Heading>
    {Object.entries(values).length === 0 ? <Text>No answers in this section.</Text>
      : Object.entries(values).map(([key, value]) => <Section key={key} style={{ borderBottom: "1px solid #e2e8f0", padding: "12px 0" }}>
        <Text style={{ margin: "0 0 6px", fontWeight: "bold", overflowWrap: "anywhere" }}>{labels[`${scope}:${key}`] || key}</Text>
        <Text style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{displayValue(value).split("\n").map((line, index) => <React.Fragment key={index}>{index > 0 && <br />}{line}</React.Fragment>)}</Text>
      </Section>)}
  </Section>;
}
function DecisionReceiptEmail({ challenge = {}, classroom = {}, receiptNumber, savedTime, kind,
  variables = {}, challengeVariableAnswers = {}, labels = {}, link }) {
  const updated = kind === "update";
  return <Html><Head /><Preview>{updated ? "Updated decisions saved" : "Decisions saved"}: {challenge.title}</Preview>
    <Body style={{ backgroundColor: "#f6f7fb", fontFamily: "Arial, sans-serif", color: "#172033", margin: 0 }}>
      <Container style={{ backgroundColor: "#ffffff", margin: "24px auto", padding: "24px", maxWidth: "600px", width: "100%", boxSizing: "border-box" }}>
        <Text style={{ color: "#4f46e5", fontWeight: "bold" }}>SCALE · {classroom.name}</Text>
        <Heading style={{ fontSize: "26px" }}>{updated ? "Your updated decisions were saved" : "Your decisions were saved"}</Heading>
        <Text><strong>Challenge:</strong> {challenge.title}<br /><strong>Saved at:</strong> {savedTime}<br /><strong>Receipt:</strong> {receiptNumber}</Text>
        <Text>This receipt is a copy of the answers saved at the time shown above. Later updates may supersede these answers.</Text>
        <Answers title="Decision variables" values={variables} labels={labels} scope="decision" />
        <Answers title="Challenge answers" values={challengeVariableAnswers} labels={labels} scope="challenge" />
        <Button href={link} style={{ backgroundColor: "#0f766e", color: "#ffffff", borderRadius: "6px", padding: "14px 20px", marginTop: "24px" }}>View challenge</Button>
        <Text style={{ color: "#64748b", fontSize: "12px", marginTop: "24px" }}>Keep this email as your submission receipt.</Text>
      </Container>
    </Body></Html>;
}
module.exports = { DecisionReceiptEmail, displayValue };
