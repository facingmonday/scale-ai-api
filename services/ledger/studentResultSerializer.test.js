const test = require("node:test");
const assert = require("node:assert/strict");

const {
  serializeStudentLedgerEntry,
} = require("./studentResultSerializer");

test("student ledger serialization labels details and excludes internal context", () => {
  const result = serializeStudentLedgerEntry(
    {
      _id: "ledger-1",
      userId: "student-1",
      summary: "Your store remained profitable.",
      metrics: { cashBefore: 100, netProfit: 20, cashAfter: 120 },
      randomEvent: "A public event",
      aiMetadata: { prompt: "secret", model: "internal-model" },
      hiddenNotes: "teacher-only",
      otherStudents: [{ userId: "student-2" }],
      calculationContext: {
        priorMetrics: { cashAfter: 100 },
        decisionVariables: { unitPrice: 8 },
        outcomeVariables: { demandIndex: 1.2 },
        prompt: "raw calculation prompt",
        ledgerHistorySummary: [{ userId: "student-2" }],
      },
      studentFeedback: {
        status: "completed",
        keyDrivers: [
          {
            title: "Price",
            explanation: "Pricing supported the result.",
            impact: "positive",
            source: "decision",
          },
        ],
        nextActions: [
          { title: "Review inventory", rationale: "Reduce stockouts." },
          { title: "Protect cash", rationale: "Keep room to adjust." },
        ],
        error: "must not be exposed",
      },
    },
    {
      metricDefinitions: [
        { key: "cashAfter", label: "Ending Cash", dataType: "number" },
      ],
      variableDefinitions: [
        { key: "unitPrice", label: "Unit Price", appliesTo: "decision" },
        { key: "demandIndex", label: "Demand Index", appliesTo: "outcome" },
      ],
      outcomeNotes: "Public demand increased.",
    },
  );

  const encoded = JSON.stringify(result);
  assert.equal(encoded.includes("teacher-only"), false);
  assert.equal(encoded.includes("raw calculation prompt"), false);
  assert.equal(encoded.includes("internal-model"), false);
  assert.equal(encoded.includes("student-2"), false);
  assert.equal(encoded.includes("must not be exposed"), false);
  assert.equal(result.resultExplanation.details.decisions[0].label, "Unit Price");
  assert.equal(result.resultExplanation.details.finalMetrics[2].label, "Ending Cash");
  assert.equal(result.resultExplanation.details.deterministicCalculations.length, 1);
  assert.equal(result.resultExplanation.nextActions.length, 2);
});

test("modeled results do not invent arithmetic when continuity does not match", () => {
  const result = serializeStudentLedgerEntry({
    summary: "Modeled result",
    metrics: { cashBefore: 100, netProfit: 20, cashAfter: 135 },
  });

  assert.deepEqual(
    result.resultExplanation.details.deterministicCalculations,
    [],
  );
  assert.match(result.resultExplanation.modeledOutcomeNotice, /modeled simulation outcomes/);
});
