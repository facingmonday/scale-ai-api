const Challenge = require("../challenge.model");
const Decision = require("../../decision/decision.model");
const mapWithConcurrency = require("../../decision/lib/mapWithConcurrency");
const LedgerEntry = require("../../ledger/ledger.model");
const MetricDefinition = require("../../metricDefinition/metricDefinition.model");
const Outcome = require("../../outcome/outcome.model");
const ProfileType = require("../../profileType/profileType.model");
const VariableDefinition = require("../../variableDefinition/variableDefinition.model");

const PREVIEW_CASES = new Set(["baseline", "absence_penalty"]);
const PREVIEW_CONCURRENCY = 3;

function asPlainMap(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === "function") {
    return value.toObject({ flattenMaps: true });
  }
  return typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function asPlainDocument(value) {
  if (!value) return null;
  return typeof value.toObject === "function"
    ? value.toObject({ flattenMaps: true })
    : value;
}

function normalizeAbsencePunishmentLevel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["low", "medium", "high"].includes(normalized)
    ? normalized
    : null;
}

function validationMessage(validation, fallback) {
  const errors = Array.isArray(validation?.errors) ? validation.errors : [];
  if (errors.length === 0) return fallback;
  return errors.map((item) => item.message).join(", ");
}

async function resolveScopeValues(classroomId, appliesTo, input, options = {}) {
  const filteredInput = await VariableDefinition.filterVariablesByActiveDefinitions(
    classroomId,
    appliesTo,
    asPlainMap(input),
    options,
  );
  const withDefaults = await VariableDefinition.applyDefaults(
    classroomId,
    appliesTo,
    filteredInput,
    options,
  );
  const values = await VariableDefinition.filterVariablesByActiveDefinitions(
    classroomId,
    appliesTo,
    withDefaults,
    options,
  );
  const validation = await VariableDefinition.validateValues(
    classroomId,
    appliesTo,
    values,
    options,
  );

  return { values, validation };
}

function labeledValues(values, definitions) {
  const valueMap = asPlainMap(values);
  return (Array.isArray(definitions) ? definitions : [])
    .filter((definition) =>
      Object.prototype.hasOwnProperty.call(valueMap, definition.key),
    )
    .sort((left, right) => {
      const orderDifference = (left.sortOrder || 0) - (right.sortOrder || 0);
      if (orderDifference !== 0) return orderDifference;
      return String(left.label || left.key).localeCompare(
        String(right.label || right.key),
      );
    })
    .map((definition) => ({
      key: definition.key,
      label: definition.label || definition.key,
      description: definition.description || "",
      value: valueMap[definition.key],
      dataType: definition.dataType,
      format: definition.format || null,
    }));
}

function mergeDefinitionsByKey(...definitionGroups) {
  const definitionsByKey = new Map();
  for (const definitions of definitionGroups) {
    for (const definition of Array.isArray(definitions) ? definitions : []) {
      definitionsByKey.set(definition.key, definition);
    }
  }
  return Array.from(definitionsByKey.values());
}

function sanitizeMetricDefinitions(definitions) {
  return (Array.isArray(definitions) ? definitions : []).map((definition) => ({
    key: definition.key,
    label: definition.label,
    description: definition.description || "",
    dataType: definition.dataType,
    format: definition.format,
    displayIn: definition.displayIn,
    sortOrder: definition.sortOrder || 0,
    isActive: definition.isActive !== false,
  }));
}

function makeInspectionCheck(key, passed, message, details = null) {
  return {
    key,
    passed,
    message,
    ...(details ? { details } : {}),
  };
}

function validateInitialMetrics(metrics, metricDefinitions) {
  const errors = [];
  for (const definition of metricDefinitions) {
    const value = metrics[definition.key];
    if (definition.dataType === "number" && !Number.isFinite(value)) {
      errors.push(`${definition.label || definition.key} must start with a number`);
    } else if (definition.dataType === "boolean" && typeof value !== "boolean") {
      errors.push(`${definition.label || definition.key} must start with true or false`);
    } else if (definition.dataType === "string" && typeof value !== "string") {
      errors.push(`${definition.label || definition.key} must start with text`);
    }
  }
  return errors;
}

async function inspectChallengePreview({
  challengeId,
  organizationId,
  metricDefinitions: providedMetricDefinitions = null,
}) {
  const challenge = await Challenge.getScenarioById(challengeId, organizationId);
  if (!challenge) {
    const error = new Error("Challenge not found");
    error.statusCode = 404;
    throw error;
  }

  const classroomId = challenge.classroomId;
  const options = { challengeId };
  const [outcomeDocument, profileTypes, metricDefinitions, definitions] =
    await Promise.all([
      Outcome.findOne({ challengeId, organization: organizationId }),
      ProfileType.getStoreTypesByClassroom(classroomId, organizationId),
      Array.isArray(providedMetricDefinitions)
        ? providedMetricDefinitions
        : MetricDefinition.find({
            classroomId,
            organization: organizationId,
            isActive: true,
          }).sort({ sortOrder: 1, label: 1 }),
      Promise.all([
        VariableDefinition.getDefinitionsForScope(classroomId, "profile"),
        VariableDefinition.getDefinitionsForScope(classroomId, "profileType"),
        VariableDefinition.getDefinitionsForScope(
          classroomId,
          "challenge",
          options,
        ),
        VariableDefinition.getDefinitionsForScope(
          classroomId,
          "decision",
          options,
        ),
        VariableDefinition.getDefinitionsForScope(classroomId, "outcome"),
      ]),
    ]);

  if (outcomeDocument && typeof outcomeDocument._loadVariables === "function") {
    await outcomeDocument._loadVariables();
  }
  const outcome = asPlainDocument(outcomeDocument);
  const [
    profileDefinitions,
    profileTypeDefinitions,
    challengeDefinitions,
    decisionDefinitions,
    outcomeDefinitions,
  ] = definitions;

  const numericMetrics = metricDefinitions.filter(
    (definition) => definition.dataType === "number",
  );
  const checks = [
    makeInspectionCheck(
      "active_numeric_metrics",
      numericMetrics.length > 0,
      numericMetrics.length > 0
        ? `${numericMetrics.length} active numeric metric${numericMetrics.length === 1 ? " is" : "s are"} configured.`
        : "This classroom has no active numeric metrics for simulation results.",
    ),
  ];
  let challengeVariables = {};
  let decisionVariables = {};
  let outcomeVariables = {};
  let profileDefaults = {};

  const challengeResolution = await resolveScopeValues(
    classroomId,
    "challenge",
    challenge.variables,
    options,
  );
  challengeVariables = challengeResolution.values;
  checks.push(
    makeInspectionCheck(
      "challenge_defaults",
      challengeResolution.validation.isValid,
      challengeResolution.validation.isValid
        ? "Challenge inputs and defaults are valid."
        : validationMessage(
            challengeResolution.validation,
            "Challenge inputs or defaults are invalid.",
          ),
      challengeResolution.validation.isValid
        ? null
        : challengeResolution.validation.errors,
    ),
  );

  try {
    decisionVariables = await Decision.resolveDefaultVariables(
      classroomId,
      challengeId,
    );
    checks.push(
      makeInspectionCheck(
        "decision_defaults",
        true,
        "Default decision values are valid.",
      ),
    );
  } catch (error) {
    checks.push(
      makeInspectionCheck(
        "decision_defaults",
        false,
        error.message || "Default decision values are invalid.",
        error.details || null,
      ),
    );
  }

  if (!outcome) {
    checks.push(
      makeInspectionCheck(
        "global_outcome",
        false,
        "A saved global outcome is required before previewing results.",
      ),
    );
  } else {
    const outcomeResolution = await resolveScopeValues(
      classroomId,
      "outcome",
      outcome.variables,
    );
    outcomeVariables = outcomeResolution.values;
    checks.push(
      makeInspectionCheck(
        "global_outcome",
        outcomeResolution.validation.isValid,
        outcomeResolution.validation.isValid
          ? "The saved global outcome and its defaults are valid."
          : validationMessage(
              outcomeResolution.validation,
              "The saved global outcome is invalid.",
            ),
        outcomeResolution.validation.isValid
          ? null
          : outcomeResolution.validation.errors,
      ),
    );
  }

  checks.push(
    makeInspectionCheck(
      "active_profile_types",
      profileTypes.length > 0,
      profileTypes.length > 0
        ? `${profileTypes.length} active store type${profileTypes.length === 1 ? " is" : "s are"} available for preview.`
        : "At least one active store type is required for preview.",
    ),
  );

  const profileDefaultResolution = await resolveScopeValues(
    classroomId,
    "profile",
    {},
  );
  profileDefaults = profileDefaultResolution.values;
  const profileErrors = profileDefaultResolution.validation.isValid
    ? []
    : profileDefaultResolution.validation.errors.map((item) => item.message);
  const syntheticProfiles = [];
  const weekZeroErrors = [];

  for (const profileType of profileTypes) {
    const profileTypeResolution = await resolveScopeValues(
      classroomId,
      "profileType",
      profileType.variables,
    );
    if (!profileTypeResolution.validation.isValid) {
      profileErrors.push(
        `${profileType.label}: ${validationMessage(
          profileTypeResolution.validation,
          "invalid profile-type defaults",
        )}`,
      );
    }

    const typeValues = { ...profileTypeResolution.values };
    if (typeValues.startingBalance === undefined) {
      typeValues.startingBalance = profileType.startingBalance;
    }
    if (typeValues.initialStartupCost === undefined) {
      typeValues.initialStartupCost = profileType.initialStartupCost;
    }
    const mergedVariables = { ...typeValues, ...profileDefaults };
    const metadataByKey = new Map();
    for (const definition of profileTypeDefinitions) {
      metadataByKey.set(definition.key, definition);
    }
    for (const definition of profileDefinitions) {
      metadataByKey.set(definition.key, definition);
    }
    const variablesDetailed = {};
    for (const [key, value] of Object.entries(mergedVariables)) {
      const definition = metadataByKey.get(key);
      variablesDetailed[key] = {
        key,
        label: definition?.label || key,
        description: definition?.description || "",
        value,
      };
    }

    const profile = {
      shopName: `Synthetic ${profileType.label}`,
      profileType: profileType.key,
      profileTypeLabel: profileType.label,
      profileTypeDescription: profileType.description || "",
      profileDescription: profileType.description || "",
      startingBalance: profileType.startingBalance,
      initialStartupCost: profileType.initialStartupCost,
      ...mergedVariables,
      variablesDetailed,
    };
    const priorMetrics = LedgerEntry.buildInitialMetrics(
      metricDefinitions,
      profile,
    );
    const initialMetricErrors = validateInitialMetrics(
      priorMetrics,
      metricDefinitions,
    );
    if (LedgerEntry.calculateOpeningCash(profile) === null) {
      initialMetricErrors.push("starting balance and startup cost must be numeric");
    }
    if (initialMetricErrors.length > 0) {
      weekZeroErrors.push(
        `${profileType.label}: ${initialMetricErrors.join(", ")}`,
      );
    }

    syntheticProfiles.push({ profileType, profile, priorMetrics });
  }

  checks.push(
    makeInspectionCheck(
      "profile_type_defaults",
      profileErrors.length === 0,
      profileErrors.length === 0
        ? "Profile and store-type defaults are valid."
        : profileErrors.join("; "),
      profileErrors.length === 0 ? null : profileErrors,
    ),
  );
  checks.push(
    makeInspectionCheck(
      "synthetic_week_zero",
      weekZeroErrors.length === 0,
      weekZeroErrors.length === 0
        ? "Synthetic Week 0 metrics and opening cash are valid."
        : weekZeroErrors.join("; "),
      weekZeroErrors.length === 0 ? null : weekZeroErrors,
    ),
  );

  return {
    valid: checks.every((item) => item.passed),
    checks,
    configuration: {
      challenge: { ...challenge, variables: challengeVariables },
      outcome: outcome ? { ...outcome, variables: outcomeVariables } : null,
      profileTypes: syntheticProfiles,
      decisionVariables,
      metricDefinitions,
      definitions: {
        profile: profileDefinitions,
        profileType: profileTypeDefinitions,
        challenge: challengeDefinitions,
        decision: decisionDefinitions,
        outcome: outcomeDefinitions,
      },
    },
  };
}

function buildAttemptTargets(configuration, requestedTargets) {
  const punishmentLevel = normalizeAbsencePunishmentLevel(
    configuration.challenge.punishAbsentStudents,
  );
  const profileById = new Map(
    configuration.profileTypes.map((item) => [
      String(item.profileType._id),
      item,
    ]),
  );
  const targets = [];

  if (requestedTargets !== undefined && !Array.isArray(requestedTargets)) {
    const error = new Error("targets must be an array");
    error.statusCode = 400;
    throw error;
  }

  if (Array.isArray(requestedTargets)) {
    const seen = new Set();
    for (const target of requestedTargets) {
      const profileTypeId = String(target?.profileTypeId || "");
      const caseKind = String(target?.case || "");
      const key = `${profileTypeId}:${caseKind}`;
      if (!profileById.has(profileTypeId)) {
        const error = new Error("Preview target contains an inactive or invalid store type");
        error.statusCode = 400;
        throw error;
      }
      if (!PREVIEW_CASES.has(caseKind)) {
        const error = new Error("Preview case must be baseline or absence_penalty");
        error.statusCode = 400;
        throw error;
      }
      if (caseKind === "absence_penalty" && !punishmentLevel) {
        const error = new Error(
          "The absence_penalty case is unavailable because no punishment is configured",
        );
        error.statusCode = 400;
        throw error;
      }
      if (!seen.has(key)) {
        seen.add(key);
        targets.push({ syntheticProfile: profileById.get(profileTypeId), caseKind });
      }
    }
    if (targets.length === 0) {
      const error = new Error("At least one preview target is required");
      error.statusCode = 400;
      throw error;
    }
    return { targets, punishmentLevel };
  }

  for (const syntheticProfile of configuration.profileTypes) {
    targets.push({ syntheticProfile, caseKind: "baseline" });
    if (punishmentLevel) {
      targets.push({ syntheticProfile, caseKind: "absence_penalty" });
    }
  }
  return { targets, punishmentLevel };
}

function logSafeErrorMessage(error) {
  const message = String(error?.message || "Simulation failed")
    .replace(/[\r\n]+/g, " ")
    .trim();
  return message.slice(0, 300) || "Simulation failed";
}

async function runChallengePreview({ challengeId, organizationId, targets }) {
  const startedAt = Date.now();
  const inspection = await inspectChallengePreview({
    challengeId,
    organizationId,
  });
  if (!inspection.valid) {
    const error = new Error("Challenge preview is not ready");
    error.code = "CHALLENGE_PREVIEW_NOT_READY";
    error.statusCode = 409;
    error.checks = inspection.checks;
    throw error;
  }

  const configuration = inspection.configuration;
  const { targets: attemptsToRun, punishmentLevel } = buildAttemptTargets(
    configuration,
    targets,
  );
  const challengeIdString = String(configuration.challenge._id || challengeId);
  const attempts = await mapWithConcurrency(
    attemptsToRun,
    PREVIEW_CONCURRENCY,
    async ({ syntheticProfile, caseKind }) => {
      const profileTypeId = String(syntheticProfile.profileType._id);
      const decision = {
        classroomId: configuration.challenge.classroomId,
        challengeId: challengeIdString,
        variables: configuration.decisionVariables,
        challengeVariableAnswers: configuration.challenge.variables,
        generation: {
          method: "DEFAULTS",
          meta:
            caseKind === "absence_penalty"
              ? {
                  absentPunishmentLevel: punishmentLevel,
                  note: "Synthetic preview absence-penalty case",
                }
              : { note: "Synthetic preview baseline" },
        },
      };
      const inputs = {
        startingPosition: labeledValues(
          syntheticProfile.priorMetrics,
          configuration.metricDefinitions,
        ),
        profile: labeledValues(
          syntheticProfile.profile,
          mergeDefinitionsByKey(
            configuration.definitions.profileType,
            configuration.definitions.profile,
          ),
        ),
        challenge: labeledValues(
          configuration.challenge.variables,
          configuration.definitions.challenge,
        ),
        decisions: labeledValues(
          configuration.decisionVariables,
          configuration.definitions.decision,
        ),
        outcome: labeledValues(
          configuration.outcome.variables,
          configuration.definitions.outcome,
        ),
        outcomeNotes: configuration.outcome.notes || "",
      };

      try {
        const aiResult = await LedgerEntry.runAISimulation({
          profile: syntheticProfile.profile,
          challenge: configuration.challenge,
          outcome: configuration.outcome,
          decision,
          ledgerHistory: [],
          priorMetrics: syntheticProfile.priorMetrics,
        });
        return {
          profileTypeId,
          case: caseKind,
          status: "completed",
          inputs,
          result: {
            metrics: LedgerEntry.extractMetricsFromAIResult(
              aiResult,
              configuration.metricDefinitions,
            ),
            summary: aiResult.summary,
          },
        };
      } catch (error) {
        console.error("Challenge preview case failed", {
          challengeId: challengeIdString,
          profileTypeId,
          case: caseKind,
          error: logSafeErrorMessage(error),
        });
        return {
          profileTypeId,
          case: caseKind,
          status: "failed",
          inputs,
          error: {
            code: "SIMULATION_FAILED",
            message:
              "This preview case could not be generated. Retry it or review the server logs.",
            retryable: true,
          },
        };
      }
    },
  );

  const groupedAttempts = new Map();
  for (const attempt of attempts) {
    if (!groupedAttempts.has(attempt.profileTypeId)) {
      groupedAttempts.set(attempt.profileTypeId, []);
    }
    groupedAttempts.get(attempt.profileTypeId).push(attempt);
  }
  const selectedProfileTypeIds = new Set(attempts.map((item) => item.profileTypeId));
  const profileTypes = configuration.profileTypes
    .filter((item) => selectedProfileTypeIds.has(String(item.profileType._id)))
    .map((item) => ({
      profileType: {
        id: String(item.profileType._id),
        key: item.profileType.key,
        label: item.profileType.label,
        description: item.profileType.description || "",
      },
      cases: groupedAttempts.get(String(item.profileType._id)) || [],
    }));

  const completedCases = attempts.filter((item) => item.status === "completed").length;
  const failedCases = attempts.length - completedCases;
  const status = failedCases > 0 ? "partial" : "completed";
  const durationMs = Date.now() - startedAt;

  console.info("Challenge preview completed", {
    challengeId: challengeIdString,
    durationMs,
    profileTypeCount: profileTypes.length,
    caseCount: attempts.length,
    completedCases,
    failedCases,
  });

  return {
    status,
    generatedAt: new Date().toISOString(),
    durationMs,
    assumptions: {
      priorState: "week_zero_defaults",
      freshRun: true,
      writesResults: false,
      punishmentLevel,
    },
    metricDefinitions: sanitizeMetricDefinitions(
      configuration.metricDefinitions,
    ),
    profileTypes,
    completedCases,
    failedCases,
  };
}

module.exports = {
  PREVIEW_CASES,
  inspectChallengePreview,
  runChallengePreview,
};
