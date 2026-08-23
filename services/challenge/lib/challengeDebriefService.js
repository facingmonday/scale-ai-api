const openai = require("../../../lib/openai");
const Challenge = require("../challenge.model");
const LedgerEntry = require("../../ledger/ledger.model");
const Profile = require("../../profile/profile.model");
const MetricDefinition = require("../../metricDefinition/metricDefinition.model");
const VariableDefinition = require("../../variableDefinition/variableDefinition.model");

const DEBRIEF_MODEL =
  process.env.CHALLENGE_DEBRIEF_AI_MODEL ||
  process.env.AI_MODEL ||
  "gpt-5-mini-2025-08-07";
const NO_RESULTS_SUMMARY =
  "No student results were available for this challenge, so there are no outcomes to debrief.";

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function toPlainObject(value) {
  if (value instanceof Map) return Object.fromEntries(value);
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function numericSummary(rows, metricDefinitions) {
  const result = {};
  for (const definition of metricDefinitions) {
    const values = rows
      .map((row) => row.metrics?.[definition.key])
      .filter((value) => !isBlank(value))
      .map(Number)
      .filter(Number.isFinite);
    if (values.length === 0) continue;
    result[definition.key] = {
      label: definition.label || definition.key,
      count: values.length,
      average: round(values.reduce((sum, value) => sum + value, 0) / values.length),
      min: round(Math.min(...values)),
      max: round(Math.max(...values)),
    };
  }
  return result;
}

function isSensitiveVariable(definition) {
  const text = `${definition.key || ""} ${definition.label || ""}`;
  return /email|prompt|summary|random.?event|(user|member|student|shop|store).*(id|name|email)/i.test(
    text,
  );
}

function isBlank(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function exactGroupLabel(value) {
  if (isBlank(value)) return "not provided";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).slice(0, 80);
}

function buildNumericBucket(value, min, max) {
  if (min === max) return `value ${round(min)}`;
  const width = (max - min) / 3;
  if (value <= min + width) return `low (${round(min)}–${round(min + width)})`;
  if (value <= min + width * 2) {
    return `middle (${round(min + width)}–${round(min + width * 2)})`;
  }
  return `high (${round(min + width * 2)}–${round(max)})`;
}

function variableGroupLabel(value, definition, numericValues) {
  if (definition.dataType === "number") {
    if (isBlank(value) || !Number.isFinite(Number(value))) return "not provided";
    const distinct = new Set(numericValues.map((item) => Number(item)));
    if (distinct.size <= 5) return exactGroupLabel(Number(value));
    return buildNumericBucket(
      Number(value),
      Math.min(...numericValues),
      Math.max(...numericValues),
    );
  }

  const categorical =
    definition.dataType === "boolean" ||
    definition.dataType === "select" ||
    ["dropdown", "selectbutton", "multiple-choice"].includes(
      definition.inputType,
    );
  if (categorical) return exactGroupLabel(value);
  return isBlank(value) ? "not provided" : "provided";
}

function buildAnonymousAggregateFromRows({
  rows,
  metricDefinitions,
  variableDefinitions,
}) {
  const numericMetricDefinitions = metricDefinitions.filter(
    (definition) => definition.dataType === "number",
  );
  const performanceDefinition =
    numericMetricDefinitions.find(
      (definition) => definition.displayIn?.leaderboard,
    ) || numericMetricDefinitions[0] || null;

  const profileTypeMap = new Map();
  for (const row of rows) {
    const label = row.profileType || "Unspecified profile type";
    if (!profileTypeMap.has(label)) profileTypeMap.set(label, []);
    profileTypeMap.get(label).push(row);
  }

  const profileTypeGroups = Array.from(profileTypeMap.entries())
    .map(([profileType, groupRows]) => ({
      profileType,
      count: groupRows.length,
      metrics: numericSummary(groupRows, numericMetricDefinitions),
    }))
    .sort((left, right) => left.profileType.localeCompare(right.profileType));

  const decisionVariableGroups = [];
  for (const definition of variableDefinitions) {
    if (isSensitiveVariable(definition)) continue;
    const rowsWithValue = rows.filter((row) =>
      Object.prototype.hasOwnProperty.call(
        row.decisionVariables || {},
        definition.key,
      ),
    );
    if (rowsWithValue.length === 0) continue;

    const numericValues = rowsWithValue
      .map((row) => row.decisionVariables?.[definition.key])
      .filter((value) => !isBlank(value))
      .map(Number)
      .filter(Number.isFinite);
    const groups = new Map();
    for (const row of rowsWithValue) {
      const value = row.decisionVariables?.[definition.key];
      const label = variableGroupLabel(value, definition, numericValues);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(row);
    }

    decisionVariableGroups.push({
      key: definition.key,
      label: definition.label || definition.key,
      groups: Array.from(groups.entries())
        .map(([value, groupRows]) => ({
          value,
          count: groupRows.length,
          metrics: numericSummary(groupRows, numericMetricDefinitions),
        }))
        .sort((left, right) => left.value.localeCompare(right.value)),
    });
  }

  return {
    totalResults: rows.length,
    performanceMetric: performanceDefinition
      ? {
          key: performanceDefinition.key,
          label: performanceDefinition.label || performanceDefinition.key,
        }
      : null,
    overallMetrics: numericSummary(rows, numericMetricDefinitions),
    profileTypeGroups,
    decisionVariableGroups,
  };
}

async function buildAnonymousAggregate({ challenge, organizationId }) {
  const [ledgers, metricDefinitions, variableDefinitions] = await Promise.all([
    LedgerEntry.find({
      challengeId: challenge._id,
      organization: organizationId,
    })
      .select(
        "profileId metrics calculationContext.decisionVariables",
      )
      .lean(),
    MetricDefinition.find({
      classroomId: challenge.classroomId,
      organization: organizationId,
      isActive: true,
      dataType: "number",
    })
      .sort({ sortOrder: 1, label: 1 })
      .lean(),
    VariableDefinition.find({
      classroomId: challenge.classroomId,
      organization: organizationId,
      isActive: true,
      appliesTo: "decision",
      $or: [{ challengeId: null }, { challengeId: challenge._id }],
    })
      .select("key label dataType inputType appliesTo")
      .sort({ appliesTo: 1, label: 1 })
      .lean(),
  ]);

  const profileIds = ledgers.map((ledger) => ledger.profileId).filter(Boolean);
  const profiles = profileIds.length
    ? await Profile.find({
        _id: { $in: profileIds },
        classroomId: challenge.classroomId,
        organization: organizationId,
      })
        .select("_id profileType")
        .populate("profileType", "key label")
        .lean()
    : [];
  const profileTypeByProfileId = new Map(
    profiles.map((profile) => [
      String(profile._id),
      profile.profileType?.label || profile.profileType?.key || "Unspecified profile type",
    ]),
  );

  const rows = ledgers.map((ledger) => ({
    metrics: toPlainObject(ledger.metrics),
    profileType:
      profileTypeByProfileId.get(String(ledger.profileId)) ||
      "Unspecified profile type",
    decisionVariables: toPlainObject(
      ledger.calculationContext?.decisionVariables,
    ),
  }));

  return buildAnonymousAggregateFromRows({
    rows,
    metricDefinitions,
    variableDefinitions,
  });
}

function buildOpenAIRequest(aggregate) {
  return {
    model: DEBRIEF_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a teaching assistant analyzing anonymized aggregate simulation results. Write a concise teacher-facing debrief (maximum 250 words) covering overall outcomes, decision-variable patterns associated with stronger or weaker results, likely failure factors only when the aggregate supports them, and useful teaching takeaways. Use the named performance metric to describe lower-performing groups. Do not imply causation from correlation, do not invent a generalized failure threshold, call out uncertainty and small or ambiguous differences, and never speculate about individual students or stores. Return plain text only.",
      },
      {
        role: "user",
        content: JSON.stringify(aggregate),
      },
    ],
  };
}

function conflict(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

async function generateChallengeDebrief({
  challengeId,
  organizationId,
  force = false,
  openaiClient = openai,
}) {
  const challenge = await Challenge.findOne({
    _id: challengeId,
    organization: organizationId,
  }).select("+teacherDebrief");
  if (!challenge) {
    const error = new Error("Challenge not found");
    error.statusCode = 404;
    throw error;
  }
  if (!challenge.isClosed) {
    throw conflict("Challenge results are not complete");
  }

  const LedgerCompletionEvent = require("../../job/ledgerCompletionEvent.model");
  const readiness = await LedgerCompletionEvent.evaluateChallenge(challengeId);
  if (!readiness.ready) {
    throw conflict(`Challenge results are not complete: ${readiness.reason}`);
  }

  if (!force && challenge.teacherDebrief?.status === "completed") {
    return { challenge, teacherDebrief: challenge.teacherDebrief, skipped: true };
  }

  const claimQuery = {
    _id: challengeId,
    organization: organizationId,
  };
  if (force) {
    claimQuery["teacherDebrief.status"] = { $ne: "processing" };
  } else {
    claimQuery.$or = [
      { "teacherDebrief.status": { $exists: false } },
      { "teacherDebrief.status": { $in: ["pending", "failed"] } },
    ];
  }

  const claimed = await Challenge.findOneAndUpdate(
    claimQuery,
    {
      $set: {
        "teacherDebrief.status": "processing",
        "teacherDebrief.error": null,
      },
      $inc: { "teacherDebrief.attempts": 1 },
    },
    { new: true },
  ).select("+teacherDebrief");

  if (!claimed) {
    const current = await Challenge.findOne({
      _id: challengeId,
      organization: organizationId,
    }).select("+teacherDebrief");
    if (!force && current?.teacherDebrief?.status === "completed") {
      return { challenge: current, teacherDebrief: current.teacherDebrief, skipped: true };
    }
    throw conflict("Challenge debrief generation is already in progress");
  }

  try {
    const aggregate = await buildAnonymousAggregate({
      challenge: claimed,
      organizationId,
    });
    let summary = NO_RESULTS_SUMMARY;
    if (aggregate.totalResults > 0) {
      const response = await openaiClient.chat.completions.create(
        buildOpenAIRequest(aggregate),
      );
      summary = response?.choices?.[0]?.message?.content?.trim();
      if (!summary) throw new Error("OpenAI returned an empty challenge debrief");
    }

    const generatedAt = new Date();
    const updated = await Challenge.findOneAndUpdate(
      {
        _id: challengeId,
        organization: organizationId,
        "teacherDebrief.status": "processing",
      },
      {
        $set: {
          "teacherDebrief.summary": summary,
          "teacherDebrief.status": "completed",
          "teacherDebrief.generatedAt": generatedAt,
          "teacherDebrief.error": null,
        },
      },
      { new: true },
    ).select("+teacherDebrief");
    if (!updated) {
      throw conflict("Challenge debrief generation was cancelled");
    }

    return {
      challenge: updated,
      teacherDebrief: updated.teacherDebrief,
      aggregate,
      skipped: false,
    };
  } catch (error) {
    await Challenge.updateOne(
      {
        _id: challengeId,
        organization: organizationId,
        "teacherDebrief.status": "processing",
      },
      {
        $set: {
          "teacherDebrief.status": "failed",
          "teacherDebrief.error": String(error.message || error).slice(0, 1000),
        },
      },
    );
    throw error;
  }
}

async function resetChallengeDebriefForRerun({ challengeId, organizationId }) {
  await Challenge.updateOne(
    { _id: challengeId, organization: organizationId },
    { $unset: { teacherDebrief: 1 } },
  );
  const LedgerCompletionEvent = require("../../job/ledgerCompletionEvent.model");
  await LedgerCompletionEvent.deleteMany({
    challengeId,
    organization: organizationId,
    eventType: LedgerCompletionEvent.EVENT_TYPES.CHALLENGE_LEDGERS_COMPLETE,
  });
}

module.exports = {
  NO_RESULTS_SUMMARY,
  buildAnonymousAggregateFromRows,
  buildAnonymousAggregate,
  buildOpenAIRequest,
  generateChallengeDebrief,
  resetChallengeDebriefForRerun,
};
