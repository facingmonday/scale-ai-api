const test = require("node:test");
const assert = require("node:assert/strict");

const LedgerEntry = require("./ledger.model");

test("ledger model exports AI simulation helpers", () => {
  assert.equal(typeof LedgerEntry.buildAISimulationPrompt, "function");
  assert.equal(typeof LedgerEntry.buildAISimulationOpenAIRequest, "function");
  assert.equal(typeof LedgerEntry.summarizeOpenAIRequest, "function");
  assert.equal(typeof LedgerEntry.shouldInspectOpenAIRequest, "function");
  assert.equal(typeof LedgerEntry.inspectOpenAIRequest, "function");
  assert.equal(typeof LedgerEntry.inspectOpenAIResponse, "function");
  assert.equal(typeof LedgerEntry.normalizeAndValidateAISimulationResult, "function");
  assert.equal(typeof LedgerEntry.runAISimulation, "function");
});

test("ledger entries flatten metric maps when serialized", () => {
  const entry = new LedgerEntry({
    metrics: {
      sales: 137,
      netProfit: 1659.95,
    },
    calculationContext: {
      decisionVariables: {
        inventoryTarget: 50,
      },
      priorMetrics: {
        cashAfter: 0,
      },
      ledgerHistorySummary: [
        {
          challengeTitle: "Previous challenge",
          metrics: { cashAfter: 1000 },
        },
      ],
    },
  });

  const serialized = entry.toObject();

  assert.equal(serialized.metrics instanceof Map, false);
  assert.deepEqual(serialized.metrics, {
    sales: 137,
    netProfit: 1659.95,
  });
  assert.deepEqual(serialized.calculationContext.decisionVariables, {
    inventoryTarget: 50,
  });
  assert.deepEqual(serialized.calculationContext.priorMetrics, {
    cashAfter: 0,
  });
  assert.deepEqual(
    serialized.calculationContext.ledgerHistorySummary[0].metrics,
    {
      cashAfter: 1000,
    }
  );

  assert.deepEqual(JSON.parse(JSON.stringify(entry)).metrics, {
    sales: 137,
    netProfit: 1659.95,
  });
});

test("shouldInspectOpenAIRequest supports an optional decision filter", (t) => {
  const originalEnabled = process.env.AI_DEBUG_REQUESTS;
  const originalDecisionId = process.env.AI_DEBUG_DECISION_ID;
  t.after(() => {
    if (originalEnabled === undefined) delete process.env.AI_DEBUG_REQUESTS;
    else process.env.AI_DEBUG_REQUESTS = originalEnabled;
    if (originalDecisionId === undefined) delete process.env.AI_DEBUG_DECISION_ID;
    else process.env.AI_DEBUG_DECISION_ID = originalDecisionId;
  });

  delete process.env.AI_DEBUG_REQUESTS;
  delete process.env.AI_DEBUG_DECISION_ID;
  assert.equal(LedgerEntry.shouldInspectOpenAIRequest({ decisionId: "one" }), false);

  process.env.AI_DEBUG_REQUESTS = "true";
  assert.equal(LedgerEntry.shouldInspectOpenAIRequest({ decisionId: "one" }), true);

  process.env.AI_DEBUG_DECISION_ID = "two";
  assert.equal(LedgerEntry.shouldInspectOpenAIRequest({ decisionId: "one" }), false);
  assert.equal(LedgerEntry.shouldInspectOpenAIRequest({ decisionId: "two" }), true);
});

test("summarizeOpenAIRequest reports message and full request sizes", () => {
  const request = {
    model: "test-model",
    messages: [
      { role: "system", content: "system policy" },
      {
        role: "user",
        content: JSON.stringify({ type: "student_decisions", data: { units: 5 } }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ledger_entry",
        schema: {
          type: "object",
          properties: { summary: { type: "string" } },
        },
      },
    },
  };

  const report = LedgerEntry.summarizeOpenAIRequest(request);

  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0].type, "plain_text");
  assert.equal(report.rows[1].type, "student_decisions");
  assert.equal(report.rows[0].hash.length, 12);
  assert.equal(report.summary.model, "test-model");
  assert.equal(report.summary.messageCount, 2);
  assert.ok(report.summary.totalMessageCharacters > 0);
  assert.ok(report.summary.totalMessageBytes > 0);
  assert.ok(report.summary.responseSchemaBytes > 0);
  assert.equal(
    report.summary.totalRequestBytes,
    Buffer.byteLength(JSON.stringify(request), "utf8")
  );
});

test("hardenAISimulationMessages prepends policy and normalizes roles to user", () => {
  const messages = [
    { role: "system", content: "sys" },
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "developer", content: "dev" },
  ];

  const hardened = LedgerEntry.hardenAISimulationMessages(messages);
  assert.equal(hardened.length, 5);
  assert.equal(hardened[0].role, "system");
  assert.equal(hardened.filter((m) => m.role === "user").length, 4);
});

test("buildAISimulationPrompt omits redundant and empty simulation context", () => {
  const messages = LedgerEntry.buildAISimulationPrompt(
    [{ role: "system", content: "class rules" }],
    {
      profileId: "profile-id",
      studentId: "student-id",
      shopName: "Test Shop",
      profileType: "campus-kiosk",
      storeTypeId: "profile-type-id",
      storeTypeLabel: "Campus Kiosk",
      storeTypeDescription: "A compact campus operation.",
      variablesDetailed: { capacity: { value: 40 } },
      capacity: 40,
    },
    { title: "Test challenge", description: "", variables: {} },
    { notes: "", hiddenNotes: "", variables: {}, randomEventChancePercent: 0 },
    { variables: { price: 12 }, generation: { method: "MANUAL" } },
    [
      {
        challengeId: { _id: "older-id", title: "Older challenge" },
        metrics: { cashAfter: 50 },
      },
      {
        challengeId: { _id: "previous-id", title: "Previous challenge" },
        metrics: { cashAfter: 100 },
      },
    ],
    { cashAfter: 100 },
    [
      {
        key: "cashAfter",
        label: "Cash Balance",
        format: "currency",
        dataType: "number",
        aiPromptRule: "Carry forward cash.",
      },
    ]
  );

  const envelopes = messages.map((message) => {
    try {
      return JSON.parse(message.content);
    } catch {
      return null;
    }
  });
  const types = envelopes.filter(Boolean).map((envelope) => envelope.type);

  assert.deepEqual(types, [
    "metrics_to_calculate",
    "challenge",
    "profile_configuration",
    "student_decisions",
    "prior_ledger_entry",
    "ledger_history",
  ]);
  assert.equal(types.includes("global_outcome"), false);

  const profileEnvelope = envelopes.find(
    (envelope) => envelope?.type === "profile_configuration"
  );
  assert.deepEqual(profileEnvelope.data.profileType, {
    key: "campus-kiosk",
    label: "Campus Kiosk",
    description: "A compact campus operation.",
  });
  assert.equal(profileEnvelope.data.capacity, 40);
  assert.equal(profileEnvelope.data.profileId, undefined);
  assert.equal(profileEnvelope.data.studentId, undefined);
  assert.equal(profileEnvelope.data.storeTypeId, undefined);
  assert.equal(profileEnvelope.data.variablesDetailed, undefined);

  const historyEnvelope = envelopes.find(
    (envelope) => envelope?.type === "ledger_history"
  );
  assert.deepEqual(historyEnvelope.entries, [
    {
      challengeTitle: "Older challenge",
      metrics: { cashAfter: 50 },
    },
  ]);
});

test("buildResponseJsonSchema keeps metric rules out of the response schema", async (t) => {
  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  const originalGetActive = MetricDefinition.getActive;
  t.after(() => {
    MetricDefinition.getActive = originalGetActive;
  });
  MetricDefinition.getActive = async () => [
    {
      key: "profit",
      label: "Profit",
      description: "Profit description",
      dataType: "number",
      aiPromptRule: "revenue - costs",
    },
  ];

  const schema = await LedgerEntry.buildResponseJsonSchema("classroom-id");

  assert.deepEqual(schema.properties.profit, { type: "number" });
  assert.equal(typeof schema.properties.summary.description, "string");
});
