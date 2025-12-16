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

function DailyStatsEmail(props) {
  const { statsData = {} } = props || {};
  const previewText = `Daily Statistics - ${statsData?.organization?.name || "Kikits"}`;
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans m-0 p-0">
          <Container className="mx-auto my-0 p-6 max-w-[700px]">
            <Heading className="text-xl font-semibold text-black">
              Daily Statistics Report
            </Heading>
            <Section className="mt-2">
              <Text className="text-sm">
                {statsData?.organization?.name} • {statsData?.reportDate}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

module.exports = {
  DailyStatsEmail,
  populatePaths: [],
};
