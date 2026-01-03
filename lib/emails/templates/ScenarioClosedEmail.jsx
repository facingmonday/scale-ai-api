const React = require("react");
const {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} = require("@react-email/components");

function ScenarioClosedEmail(props) {
  const {
    ledger = {},
    scenario = {},
    classroom = {},
    member = {},
    organization = {},
    link,
    profitLoss = "",
    env = {},
  } = props || {};

  const host = env?.SCALE_COM_HOST || "https://scale.com";
  const scenarioId = scenario?._id || scenario?.id || "scenario";
  const classroomId =
    classroom?._id || classroom?.id || classroom?.slug || "classroom";
  const ledgerLink =
    link ||
    `${host}/class/${encodeURIComponent(classroomId)}/scenario/${encodeURIComponent(scenarioId)}`;

  const scenarioTitle = scenario?.title || "Scenario results";
  const classroomName = classroom?.name || "your class";
  const memberName = member?.firstName || member?.name || "there";
  const organizationName = organization?.name;
  const previewText = `Scenario Results: ${scenarioTitle}`;

  // Format numbers for display
  const netProfit = ledger?.netProfit ?? 0;
  const revenue = ledger?.revenue ?? 0;
  const costs = ledger?.costs ?? 0;
  const sales = ledger?.sales ?? 0;
  const waste = ledger?.waste ?? 0;
  const cashAfter = ledger?.cashAfter ?? 0;

  const isProfit = netProfit >= 0;
  const profitColor = isProfit ? "#10b981" : "#ef4444"; // green for profit, red for loss

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 text-[#0f172a] m-0 p-0">
          <Container className="mx-auto my-0 p-6 max-w-[640px] bg-white shadow-sm rounded">
            <Section>
              <Heading className="text-2xl font-semibold mb-2 text-[#0f172a]">
                Scenario Results Available
              </Heading>
              <Text className="text-base text-[#334155]">Hi {memberName},</Text>
              <Text className="text-base text-[#334155]">
                Your results for <strong>{scenarioTitle}</strong> in{" "}
                {classroomName} are now available. Review your performance and
                see how your decisions impacted your business.
              </Text>
            </Section>

            <Section className="mt-4">
              <Text className="text-sm text-[#0f172a] mb-2">
                <strong>Scenario:</strong> {scenarioTitle}
              </Text>
              {scenario?.week ? (
                <Text className="text-sm text-[#0f172a] mb-2">
                  <strong>Week:</strong> {scenario.week}
                </Text>
              ) : null}
            </Section>

            {/* Results Summary */}
            <Section className="mt-4 p-4 bg-gray-50 rounded">
              <Heading className="text-lg font-semibold mb-3 text-[#0f172a]">
                Your Results
              </Heading>

              <div className="mb-3">
                <Text className="text-sm text-[#64748b] mb-1">
                  Net Profit/Loss
                </Text>
                <Text
                  className="text-2xl font-bold"
                  style={{ color: profitColor }}
                >
                  {isProfit ? "+" : ""}${netProfit.toFixed(2)}
                </Text>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Text className="text-sm text-[#64748b] mb-1">Revenue</Text>
                  <Text className="text-base font-semibold text-[#0f172a]">
                    ${revenue.toFixed(2)}
                  </Text>
                </div>
                <div>
                  <Text className="text-sm text-[#64748b] mb-1">Costs</Text>
                  <Text className="text-base font-semibold text-[#0f172a]">
                    ${costs.toFixed(2)}
                  </Text>
                </div>
                <div>
                  <Text className="text-sm text-[#64748b] mb-1">Sales</Text>
                  <Text className="text-base font-semibold text-[#0f172a]">
                    {sales}
                  </Text>
                </div>
                <div>
                  <Text className="text-sm text-[#64748b] mb-1">Waste</Text>
                  <Text className="text-base font-semibold text-[#0f172a]">
                    {waste}
                  </Text>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <Text className="text-sm text-[#64748b] mb-1">
                  Cash Balance
                </Text>
                <Text className="text-lg font-semibold text-[#0f172a]">
                  ${cashAfter.toFixed(2)}
                </Text>
              </div>

              {ledger?.randomEvent ? (
                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <Text className="text-sm font-semibold text-[#1e40af] mb-1">
                    Random Event
                  </Text>
                  <Text className="text-sm text-[#1e3a8a]">
                    {ledger.randomEvent}
                  </Text>
                </div>
              ) : null}

              {ledger?.summary ? (
                <div className="mt-4">
                  <Text className="text-sm font-semibold text-[#0f172a] mb-1">
                    Summary
                  </Text>
                  <Text className="text-sm text-[#475569] leading-relaxed">
                    {ledger.summary}
                  </Text>
                </div>
              ) : null}
            </Section>

            <Section className="mt-5 mb-2">
              <Button
                href={ledgerLink}
                className="bg-[#2563eb] text-white px-5 py-3 rounded font-medium text-base no-underline"
              >
                View Full Results
              </Button>
            </Section>
            <Text className="text-xs text-[#475569] mb-4">
              If the button does not work, copy and paste this link into your
              browser:{" "}
              <Link href={ledgerLink} className="text-[#2563eb]">
                {ledgerLink}
              </Link>
            </Text>

            <Hr className="border border-solid border-gray-200 my-6" />
            <Text className="text-xs text-[#94a3b8]">
              {organizationName ? `${organizationName} • ` : ""}
              {classroomName}
            </Text>
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
