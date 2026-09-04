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
  assert.equal(typeof LedgerEntry.calculateOpeningCash, "function");
  assert.equal(typeof LedgerEntry.buildInitialMetrics, "function");
  assert.equal(typeof LedgerEntry.generateStudentFeedback, "function");
  assert.equal(typeof LedgerEntry.enforceCashContinuity, "function");
  assert.equal(typeof LedgerEntry.normalizeAndValidateAISimulationResult, "function");
  assert.equal(typeof LedgerEntry.runAISimulation, "function");
});

test("buildInitialMetrics mirrors Week 0 defaults and opening cash", () => {
  const metrics = LedgerEntry.buildInitialMetrics(
    [
      { key: "cashBefore", dataType: "number", defaultInitialValue: 999 },
      { key: "cashAfter", dataType: "number", defaultInitialValue: 999 },
      { key: "orders", dataType: "number", defaultInitialValue: null },
      { key: "open", dataType: "boolean", defaultInitialValue: null },
      { key: "note", dataType: "string", defaultInitialValue: null },
    ],
    { startingBalance: 50000, initialStartupCost: 45000 },
  );

  assert.deepEqual(metrics, {
    cashBefore: 5000,
    cashAfter: 5000,
    orders: 0,
    open: false,
    note: "",
  });
});

test("simulation challenges suppress result notifications", () => {
  assert.equal(
    LedgerEntry.shouldSuppressNotifications({ suppressNotifications: true }),
    true,
  );
  assert.equal(
    LedgerEntry.shouldSuppressNotifications({ suppressNotifications: false }),
    false,
  );
  assert.equal(LedgerEntry.shouldSuppressNotifications(null), false);
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
  assert.equal(hardened[0].content.includes("randomEvent"), false);
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
      startingBalance: 50000,
      initialStartupCost: 13000,
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
  assert.equal(profileEnvelope.data.startingBalance, 50000);
  assert.equal(profileEnvelope.data.initialStartupCost, 13000);
  assert.equal(profileEnvelope.data.openingCashAfterStartupCost, 37000);
  assert.equal(profileEnvelope.data.profileId, undefined);
  assert.equal(profileEnvelope.data.studentId, undefined);
  assert.equal(profileEnvelope.data.storeTypeId, undefined);
  assert.equal(profileEnvelope.data.variablesDetailed, undefined);

  const metricsEnvelope = envelopes.find(
    (envelope) => envelope?.type === "metrics_to_calculate"
  );
  assert.equal(metricsEnvelope.instruction.includes("randomEvent"), false);

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

test("buildAISimulationPrompt applies the configured punishment to default decisions", () => {
  const messages = LedgerEntry.buildAISimulationPrompt(
    [],
    { profileType: "campus-kiosk" },
    { title: "Test challenge", variables: {} },
    { notes: "Shared outcome", variables: {} },
    {
      variables: { price: 12 },
      generation: {
        method: "DEFAULTS",
        meta: { absentPunishmentLevel: "high" },
      },
    },
    [],
    {},
    []
  );

  const penalty = messages.find((message) =>
    message.content.includes("ABSENCE PENALTY")
  );
  assert.ok(penalty);
  assert.match(penalty.content, /ABSENCE PENALTY — HIGH/);
  assert.match(penalty.content, /substantially lower profit/);
});

test("buildAISimulationPrompt does not punish defaults when punishment is none", () => {
  const messages = LedgerEntry.buildAISimulationPrompt(
    [],
    { profileType: "campus-kiosk" },
    { title: "Test challenge", variables: {} },
    { notes: "Shared outcome", variables: {} },
    {
      variables: { price: 12 },
      generation: {
        method: "DEFAULTS",
        meta: { absentPunishmentLevel: null },
      },
    },
    [],
    {},
    []
  );

  assert.equal(
    messages.some((message) => message.content.includes("ABSENCE PENALTY")),
    false
  );
});

test("buildAISimulationOpenAIRequest preserves outcome documents and separates student forecasts", async (t) => {
  const VariableDefinition = require("../variableDefinition/variableDefinition.model");
  const MetricDefinition = require("../metricDefinition/metricDefinition.model");
  const originalFilterContext =
    VariableDefinition.filterVariablesForAIContext;
  const originalFilterScope =
    VariableDefinition.filterVariablesByActiveDefinitions;
  const originalGetActive = MetricDefinition.getActive;
  t.after(() => {
    VariableDefinition.filterVariablesForAIContext = originalFilterContext;
    VariableDefinition.filterVariablesByActiveDefinitions = originalFilterScope;
    MetricDefinition.getActive = originalGetActive;
  });

  VariableDefinition.filterVariablesForAIContext = async (_classroomId, ctx) =>
    ctx;
  VariableDefinition.filterVariablesByActiveDefinitions = async (
    _classroomId,
    _scope,
    values
  ) => values;
  MetricDefinition.getActive = async () => [];

  const outcomeDocument = {
    variables: {},
    toObject() {
      return {
        classroomId: "classroom-id",
        challengeId: "challenge-id",
        notes: "Actual conversion is 12%.",
        hiddenNotes: "Use 120 realized orders for every student.",
        variables: {},
      };
    },
  };

  const { rawMessages, request } =
    await LedgerEntry.buildAISimulationOpenAIRequest(
      {
        profile: { startingBalance: 50000, initialStartupCost: 20000 },
        challenge: {
          _id: "challenge-id",
          classroomId: "classroom-id",
          title: "Viral Rush",
          variables: { configuredDemand: 120 },
        },
        outcome: outcomeDocument,
        decision: {
          classroomId: "classroom-id",
          challengeVariableAnswers: { expectedConversion: 10 },
          variables: {},
        },
        ledgerHistory: [],
        priorMetrics: { cashAfter: 30000 },
      },
      []
    );

  const parseEnvelopes = (messages) =>
    messages
      .map((message) => {
        try {
          return JSON.parse(message.content);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  const rawEnvelopes = parseEnvelopes(rawMessages);
  const challengeEnvelope = rawEnvelopes.find(
    (envelope) => envelope.type === "challenge"
  );
  const answersEnvelope = rawEnvelopes.find(
    (envelope) => envelope.type === "student_challenge_answers"
  );
  const outcomeEnvelope = rawEnvelopes.find(
    (envelope) => envelope.type === "global_outcome"
  );
  const profileEnvelope = rawEnvelopes.find(
    (envelope) => envelope.type === "profile_configuration"
  );

  assert.deepEqual(challengeEnvelope.data.variables, { configuredDemand: 120 });
  assert.deepEqual(answersEnvelope.data, { expectedConversion: 10 });
  assert.equal(outcomeEnvelope.data.notes, "Actual conversion is 12%.");
  assert.equal(
    outcomeEnvelope.data.hiddenNotes,
    "Use 120 realized orders for every student."
  );
  assert.equal(profileEnvelope.data.startingBalance, 50000);
  assert.equal(profileEnvelope.data.initialStartupCost, 20000);
  assert.equal(profileEnvelope.data.openingCashAfterStartupCost, 30000);
  assert.ok(
    parseEnvelopes(request.messages).some(
      (envelope) => envelope.type === "global_outcome"
    )
  );
});

test("enforceCashContinuity anchors every challenge to prior cashAfter", () => {
  const firstResult = LedgerEntry.enforceCashContinuity(
    { cashBefore: 0, cashAfter: 125, netProfit: 125 },
    { priorMetrics: { cashAfter: 30000 } }
  );
  assert.equal(firstResult.cashBefore, 30000);
  assert.equal(firstResult.cashAfter, 30125);

  const laterResult = LedgerEntry.enforceCashContinuity(
    { cashBefore: 0, cashAfter: 125, netProfit: 125 },
    { priorMetrics: new Map([["cashAfter", 51000]]) }
  );
  assert.equal(laterResult.cashBefore, 51000);
  assert.equal(laterResult.cashAfter, 51125);
});

test("calculateOpeningCash deducts the profile type startup cost once", () => {
  assert.equal(
    LedgerEntry.calculateOpeningCash({
      startingBalance: 50000,
      initialStartupCost: 20000,
    }),
    30000
  );
  assert.equal(
    LedgerEntry.calculateOpeningCash({
      startingBalance: 50000,
      initialStartupCost: 45000,
    }),
    5000
  );
});

test("cash continuity uses the prior metrics saved with a batch job", () => {
  const batchResult = LedgerEntry.enforceCashContinuity(
    { cashBefore: 0, cashAfter: 125, netProfit: 125 },
    { priorMetrics: { cashAfter: 30000 } }
  );

  assert.equal(batchResult.cashBefore, 30000);
  assert.equal(batchResult.cashAfter, 30125);
});

test("cash continuity leaves results unchanged without prior cash", () => {
  const batchResult = LedgerEntry.enforceCashContinuity(
    { cashBefore: 10, cashAfter: 135, netProfit: 125 },
    { priorMetrics: {} }
  );

  assert.equal(batchResult.cashBefore, 10);
  assert.equal(batchResult.cashAfter, 135);
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
  assert.equal(schema.properties.randomEvent, undefined);
  assert.equal(schema.required.includes("randomEvent"), false);
});
