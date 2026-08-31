function plainObject(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === "function") {
    return value.toObject({ flattenMaps: true });
  }
  return typeof value === "object" ? { ...value } : {};
}

function definitionMap(definitions) {
  return new Map(
    (Array.isArray(definitions) ? definitions : []).map((definition) => [
      definition.key,
      definition,
    ]),
  );
}

function labeledValues(values, definitions) {
  const source = plainObject(values);
  const byKey = definitionMap(definitions);
  return Object.entries(source).map(([key, value]) => {
    const definition = byKey.get(key);
    return {
      key,
      label: definition?.label || key,
      description: definition?.description || "",
      value,
      dataType: definition?.dataType || typeof value,
      format: definition?.format || null,
    };
  });
}

function deterministicCalculations(metrics) {
  const values = plainObject(metrics);
  const cashBefore = Number(values.cashBefore);
  const netProfit = Number(values.netProfit);
  const cashAfter = Number(values.cashAfter);
  if (
    !Number.isFinite(cashBefore) ||
    !Number.isFinite(netProfit) ||
    !Number.isFinite(cashAfter) ||
    Math.abs(cashBefore + netProfit - cashAfter) > 0.01
  ) {
    return [];
  }
  return [
    {
      key: "cash_continuity",
      label: "Cash continuity",
      expression: "Cash after = cash before + net profit",
      values: { cashBefore, netProfit, cashAfter },
    },
  ];
}

function buildStudentResultExplanation(entryInput, options = {}) {
  const entry = plainObject(entryInput);
  const calculationContext = plainObject(entry.calculationContext);
  const metricDefinitions = options.metricDefinitions || [];
  const variableDefinitions = options.variableDefinitions || [];
  const variableDefinitionsByScope = {
    profile: variableDefinitions.filter((item) =>
      ["profile", "profileType"].includes(item.appliesTo),
    ),
    challenge: variableDefinitions.filter((item) => item.appliesTo === "challenge"),
    decision: variableDefinitions.filter((item) => item.appliesTo === "decision"),
    outcome: variableDefinitions.filter((item) => item.appliesTo === "outcome"),
  };
  const feedback = plainObject(entry.studentFeedback);

  return {
    overview: entry.summary || "",
    keyDrivers:
      feedback.status === "completed" && Array.isArray(feedback.keyDrivers)
        ? feedback.keyDrivers
        : [],
    nextActions:
      feedback.status === "completed" && Array.isArray(feedback.nextActions)
        ? feedback.nextActions
        : [],
    guidanceStatus: feedback.status || "unavailable",
    details: {
      startingState: labeledValues(
        calculationContext.priorMetrics,
        metricDefinitions,
      ),
      profileConstraints: labeledValues(
        calculationContext.profileVariables,
        variableDefinitionsByScope.profile,
      ),
      challengeContext: labeledValues(
        calculationContext.challengeVariables,
        variableDefinitionsByScope.challenge,
      ),
      decisions: labeledValues(
        calculationContext.decisionVariables,
        variableDefinitionsByScope.decision,
      ),
      publicOutcome: {
        notes: options.outcomeNotes || "",
        values: labeledValues(
          calculationContext.outcomeVariables,
          variableDefinitionsByScope.outcome,
        ),
      },
      randomEvent: entry.randomEvent || null,
      finalMetrics: labeledValues(entry.metrics, metricDefinitions),
      deterministicCalculations: deterministicCalculations(entry.metrics),
    },
    modeledOutcomeNotice:
      "Except for calculations explicitly shown above, these values are modeled simulation outcomes based on the displayed inputs and constraints.",
  };
}

function serializeStudentLedgerEntry(entryInput, options = {}) {
  const entry = plainObject(entryInput);
  return {
    _id: entry._id,
    classroomId: entry.classroomId,
    challengeId: entry.challengeId,
    decisionId: entry.decisionId || null,
    metrics: plainObject(entry.metrics),
    randomEvent: entry.randomEvent || null,
    summary: entry.summary || "",
    createdDate: entry.createdDate,
    updatedDate: entry.updatedDate,
    overridden: entry.overridden === true,
    resultExplanation: buildStudentResultExplanation(entry, options),
  };
}

module.exports = {
  plainObject,
  labeledValues,
  deterministicCalculations,
  buildStudentResultExplanation,
  serializeStudentLedgerEntry,
};
