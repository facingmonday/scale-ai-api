const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

const Challenge = require("../challenge.model");
const Decision = require("../../decision/decision.model");
const LedgerCompletionEvent = require("../../job/ledgerCompletionEvent.model");
const SimulationJob = require("../../job/job.model");
const LedgerEntry = require("../../ledger/ledger.model");
const MetricDefinition = require("../../metricDefinition/metricDefinition.model");
const Notification = require("../../notifications/notifications.model");
const Outcome = require("../../outcome/outcome.model");
const ProfileType = require("../../profileType/profileType.model");
const VariableDefinition = require("../../variableDefinition/variableDefinition.model");
const previewService = require("./challengePreviewService");

const metricDefinitions = [
  {
    key: "cashBefore",
    label: "Cash Before",
    dataType: "number",
    format: "currency",
    defaultInitialValue: 0,
    isActive: true,
  },
  {
    key: "cashAfter",
    label: "Cash After",
    dataType: "number",
    format: "currency",
    defaultInitialValue: 0,
    isActive: true,
  },
  {
    key: "profit",
    label: "Profit",
    dataType: "number",
    format: "currency",
    defaultInitialValue: 0,
    isActive: true,
  },
];

const definitionsByScope = {
  profile: [
    {
      key: "staffCapacity",
      label: "Staff Capacity",
      dataType: "number",
      defaultValue: 4,
      isActive: true,
    },
  ],
  profileType: [
    {
      key: "weeklyRent",
      label: "Weekly Rent",
      dataType: "number",
      defaultValue: 100,
      isActive: true,
    },
  ],
  challenge: [
    {
      key: "expectedDemand",
      label: "Expected Demand",
      dataType: "number",
      defaultValue: 100,
      isActive: true,
    },
  ],
  decision: [
    {
      key: "inventoryTarget",
      label: "Inventory Target",
      dataType: "number",
      defaultValue: 25,
      isActive: true,
    },
  ],
  outcome: [
    {
      key: "actualDemand",
      label: "Actual Demand",
      dataType: "number",
      defaultValue: 110,
      isActive: true,
    },
  ],
};

function stubPreviewConfiguration(t, runSimulation) {
  const originals = {
    getScenarioById: Challenge.getScenarioById,
    resolveDefaultVariables: Decision.resolveDefaultVariables,
    createSubmission: Decision.createSubmission,
    createLedgerEntry: LedgerEntry.createLedgerEntry,
    generateStudentFeedback: LedgerEntry.generateStudentFeedback,
    createCompletionEvent: LedgerCompletionEvent.create,
    createSimulationJob: SimulationJob.create,
    createNotification: Notification.create,
    runAISimulation: LedgerEntry.runAISimulation,
    findMetricDefinitions: MetricDefinition.find,
    findOutcome: Outcome.findOne,
    getStoreTypesByClassroom: ProfileType.getStoreTypesByClassroom,
    getDefinitionsForScope: VariableDefinition.getDefinitionsForScope,
    applyDefaults: VariableDefinition.applyDefaults,
    filterVariablesByActiveDefinitions:
      VariableDefinition.filterVariablesByActiveDefinitions,
    validateValues: VariableDefinition.validateValues,
  };
  t.after(() => {
    Challenge.getScenarioById = originals.getScenarioById;
    Decision.resolveDefaultVariables = originals.resolveDefaultVariables;
    Decision.createSubmission = originals.createSubmission;
    LedgerEntry.createLedgerEntry = originals.createLedgerEntry;
    LedgerEntry.generateStudentFeedback = originals.generateStudentFeedback;
    LedgerCompletionEvent.create = originals.createCompletionEvent;
    SimulationJob.create = originals.createSimulationJob;
    Notification.create = originals.createNotification;
    LedgerEntry.runAISimulation = originals.runAISimulation;
    MetricDefinition.find = originals.findMetricDefinitions;
    Outcome.findOne = originals.findOutcome;
    ProfileType.getStoreTypesByClassroom = originals.getStoreTypesByClassroom;
    VariableDefinition.getDefinitionsForScope = originals.getDefinitionsForScope;
    VariableDefinition.applyDefaults = originals.applyDefaults;
    VariableDefinition.filterVariablesByActiveDefinitions =
      originals.filterVariablesByActiveDefinitions;
    VariableDefinition.validateValues = originals.validateValues;
  });

  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    title: "Demand week",
    description: "Prepare for demand.",
    variables: { expectedDemand: 120 },
    punishAbsentStudents: "medium",
    missingSubmissionPolicy: "SKIP",
  });
  Outcome.findOne = async () => ({
    async _loadVariables() {},
    toObject() {
      return {
        classroomId: "classroom-id",
        challengeId: "challenge-id",
        notes: "Demand was higher.",
        hiddenNotes: "Teacher context.",
        variables: { actualDemand: 140 },
      };
    },
  });
  ProfileType.getStoreTypesByClassroom = async () => [
    {
      _id: "type-a",
      key: "mobile",
      label: "Mobile",
      description: "Mobile shop",
      startingBalance: 10000,
      initialStartupCost: 2000,
      variables: { weeklyRent: 50 },
    },
    {
      _id: "type-b",
      key: "indoor",
      label: "Indoor",
      description: "Indoor shop",
      startingBalance: 20000,
      initialStartupCost: 5000,
      variables: { weeklyRent: 500 },
    },
  ];
  MetricDefinition.find = () => ({
    sort: async () => metricDefinitions,
  });
  VariableDefinition.getDefinitionsForScope = async (_classroomId, scope) =>
    definitionsByScope[scope] || [];
  VariableDefinition.filterVariablesByActiveDefinitions = async (
    _classroomId,
    _scope,
    values,
  ) => ({ ...values });
  VariableDefinition.applyDefaults = async (_classroomId, scope, values) => {
    const resolved = { ...values };
    for (const definition of definitionsByScope[scope] || []) {
      if (resolved[definition.key] === undefined) {
        resolved[definition.key] = definition.defaultValue;
      }
    }
    return resolved;
  };
  VariableDefinition.validateValues = async () => ({
    isValid: true,
    errors: [],
  });
  Decision.resolveDefaultVariables = async () => ({ inventoryTarget: 25 });

  let decisionWrites = 0;
  let ledgerWrites = 0;
  let guidanceRuns = 0;
  let completionEventWrites = 0;
  let jobWrites = 0;
  let notificationWrites = 0;
  Decision.createSubmission = async () => {
    decisionWrites += 1;
  };
  LedgerEntry.createLedgerEntry = async () => {
    ledgerWrites += 1;
  };
  LedgerEntry.generateStudentFeedback = async () => {
    guidanceRuns += 1;
  };
  LedgerCompletionEvent.create = async () => {
    completionEventWrites += 1;
  };
  SimulationJob.create = async () => {
    jobWrites += 1;
  };
  Notification.create = async () => {
    notificationWrites += 1;
  };
  LedgerEntry.runAISimulation = runSimulation;
  return {
    get decisionWrites() {
      return decisionWrites;
    },
    get ledgerWrites() {
      return ledgerWrites;
    },
    get guidanceRuns() {
      return guidanceRuns;
    },
    get completionEventWrites() {
      return completionEventWrites;
    },
    get jobWrites() {
      return jobWrites;
    },
    get notificationWrites() {
      return notificationWrites;
    },
  };
}

test("preview runs neutral and punishment cases for every active store type without writes", async (t) => {
  let calls = 0;
  const writes = stubPreviewConfiguration(t, async (context) => {
    calls += 1;
    if (
      context.profile.profileType === "indoor" &&
      context.decision.generation.meta.absentPunishmentLevel
    ) {
      throw new Error("temporary model failure");
    }
    return {
      cashBefore: context.priorMetrics.cashAfter,
      cashAfter: context.priorMetrics.cashAfter + 100,
      profit: 100,
      summary: "Synthetic result",
      aiMetadata: { prompt: "must not be returned", model: "test" },
      calculationContext: { hiddenFormula: "must not be returned" },
      studentFeedback: { nextActions: [{ title: "must not be returned" }] },
    };
  });

  const result = await previewService.runChallengePreview({
    challengeId: "challenge-id",
    organizationId: "organization-id",
  });

  assert.equal(calls, 4);
  assert.equal(result.status, "partial");
  assert.equal(result.profileTypes.length, 2);
  assert.equal(result.completedCases, 3);
  assert.equal(result.failedCases, 1);
  assert.equal(writes.decisionWrites, 0);
  assert.equal(writes.ledgerWrites, 0);
  assert.equal(writes.guidanceRuns, 0);
  assert.equal(writes.completionEventWrites, 0);
  assert.equal(writes.jobWrites, 0);
  assert.equal(writes.notificationWrites, 0);
  assert.equal(result.assumptions.punishmentLevel, "medium");
  assert.deepEqual(
    result.profileTypes.map((item) => item.cases.map((entry) => entry.case)),
    [
      ["baseline", "absence_penalty"],
      ["baseline", "absence_penalty"],
    ],
  );
  const mobileBaseline = result.profileTypes[0].cases[0];
  assert.equal(
    mobileBaseline.inputs.startingPosition.find(
      (item) => item.key === "cashBefore",
    ).value,
    8000,
  );
  assert.equal(
    mobileBaseline.inputs.profile.find((item) => item.key === "weeklyRent")
      .value,
    50,
  );
  assert.equal(
    mobileBaseline.inputs.profile.find((item) => item.key === "staffCapacity")
      .value,
    4,
  );
  assert.equal(
    mobileBaseline.inputs.challenge.find(
      (item) => item.key === "expectedDemand",
    ).value,
    120,
  );
  assert.equal(
    mobileBaseline.inputs.decisions.find(
      (item) => item.key === "inventoryTarget",
    ).value,
    25,
  );
  assert.equal(
    mobileBaseline.inputs.outcome.find((item) => item.key === "actualDemand")
      .value,
    140,
  );
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("must not be returned"), false);
  assert.equal(serialized.includes("Teacher context"), false);
  assert.equal(serialized.includes("challenge-id"), false);
});

test("preview accepts a targeted retry without rerunning other cases", async (t) => {
  let calls = 0;
  stubPreviewConfiguration(t, async (context) => {
    calls += 1;
    return {
      cashBefore: context.priorMetrics.cashAfter,
      cashAfter: context.priorMetrics.cashAfter + 50,
      profit: 50,
      summary: "Retried result",
    };
  });

  const result = await previewService.runChallengePreview({
    challengeId: "challenge-id",
    organizationId: "organization-id",
    targets: [{ profileTypeId: "type-b", case: "absence_penalty" }],
  });

  assert.equal(calls, 1);
  assert.equal(result.status, "completed");
  assert.equal(result.profileTypes.length, 1);
  assert.equal(result.profileTypes[0].profileType.id, "type-b");
  assert.equal(result.profileTypes[0].cases[0].case, "absence_penalty");
});

test("preview reports structured partial data when every requested case fails", async (t) => {
  stubPreviewConfiguration(t, async () => {
    throw new Error("model unavailable");
  });

  const result = await previewService.runChallengePreview({
    challengeId: "challenge-id",
    organizationId: "organization-id",
    targets: [{ profileTypeId: "type-a", case: "baseline" }],
  });

  assert.equal(result.status, "partial");
  assert.equal(result.completedCases, 0);
  assert.equal(result.failedCases, 1);
  assert.equal(result.profileTypes[0].cases[0].error.retryable, true);
});

test("preview omits the duplicate penalty case when punishment is none", async (t) => {
  let calls = 0;
  stubPreviewConfiguration(t, async (context) => {
    calls += 1;
    return {
      cashBefore: context.priorMetrics.cashAfter,
      cashAfter: context.priorMetrics.cashAfter,
      profit: 0,
      summary: "Baseline",
    };
  });
  Challenge.getScenarioById = async () => ({
    _id: "challenge-id",
    classroomId: "classroom-id",
    title: "Demand week",
    description: "Prepare for demand.",
    variables: { expectedDemand: 120 },
    punishAbsentStudents: "none",
    missingSubmissionPolicy: "USE_DEFAULTS",
  });

  const result = await previewService.runChallengePreview({
    challengeId: "challenge-id",
    organizationId: "organization-id",
  });

  assert.equal(calls, 2);
  assert.equal(result.assumptions.punishmentLevel, null);
  assert.deepEqual(
    result.profileTypes.map((item) => item.cases.map((entry) => entry.case)),
    [["baseline"], ["baseline"]],
  );
});

test("preview rejects an invalid targeted store type before simulation", async (t) => {
  let calls = 0;
  stubPreviewConfiguration(t, async () => {
    calls += 1;
    return {};
  });

  await assert.rejects(
    previewService.runChallengePreview({
      challengeId: "challenge-id",
      organizationId: "organization-id",
      targets: [{ profileTypeId: "inactive-type", case: "baseline" }],
    }),
    (error) => error.statusCode === 400,
  );
  assert.equal(calls, 0);
});
