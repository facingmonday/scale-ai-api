const openai = require("../../../lib/openai");
const Challenge = require("../challenge.model");
const LedgerEntry = require("../../ledger/ledger.model");
const Profile = require("../../profile/profile.model");
const ProfileType = require("../../profileType/profileType.model");
const MetricDefinition = require("../../metricDefinition/metricDefinition.model");
const VariableDefinition = require("../../variableDefinition/variableDefinition.model");

const DEBRIEF_MODEL =
  process.env.CHALLENGE_DEBRIEF_AI_MODEL ||
  process.env.AI_MODEL ||
  "gpt-5-mini-2025-08-07";
const NO_RESULTS_SUMMARY =
  "No student results were available for this challenge, so there are no outcomes to debrief.";

const DEBRIEF_ARRAY_FIELDS = [
  "strongerPatterns",
  "weakerPatterns",
  "expectedVariation",
  "suspiciousAnomalies",
  "commonMistakes",
  "discussionQuestions",
  "suggestedInterventions",
];

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
  profileTypes = [],
}) {
  const numericMetricDefinitions = metricDefinitions.filter(
    (definition) => definition.dataType === "number",
  );
  const performanceDefinition =
    MetricDefinition.selectLeaderboardDefinition(numericMetricDefinitions);

  const profileTypeMap = new Map();
  for (const profileType of profileTypes) {
    const key = profileType.key || profileType.label;
    if (!key) continue;
    profileTypeMap.set(key, {
      key,
      label: profileType.label || profileType.key,
      rows: [],
    });
  }
  for (const row of rows) {
    const label = row.profileType || "Unspecified profile type";
    const key = row.profileTypeKey || label;
    if (!profileTypeMap.has(key)) {
      profileTypeMap.set(key, { key, label, rows: [] });
    }
    profileTypeMap.get(key).rows.push(row);
  }

  const profileTypeGroups = Array.from(profileTypeMap.values())
    .map(({ key, label, rows: groupRows }) => ({
      profileTypeKey: key,
      profileType: label,
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
  const [ledgers, metricDefinitions, variableDefinitions, profileTypes] = await Promise.all([
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
    ProfileType.find({
      classroomId: challenge.classroomId,
      organization: organizationId,
      isActive: true,
    })
      .select("key label")
      .sort({ label: 1 })
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
      {
        key: profile.profileType?.key || "unspecified",
        label:
          profile.profileType?.label ||
          profile.profileType?.key ||
          "Unspecified profile type",
      },
    ]),
  );

  const rows = ledgers.map((ledger) => {
    const profileType = profileTypeByProfileId.get(String(ledger.profileId)) || {
      key: "unspecified",
      label: "Unspecified profile type",
    };
    return {
      metrics: toPlainObject(ledger.metrics),
      profileTypeKey: profileType.key,
      profileType: profileType.label,
      decisionVariables: toPlainObject(
        ledger.calculationContext?.decisionVariables,
      ),
    };
  });

  return buildAnonymousAggregateFromRows({
    rows,
    metricDefinitions,
    variableDefinitions,
    profileTypes,
  });
}

function buildOpenAIRequest(aggregate) {
  return {
    model: DEBRIEF_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a teaching assistant analyzing anonymized aggregate simulation results. Return a structured teacher-facing debrief. Cover overall outcomes, patterns associated with stronger and weaker results, expected variation, suspicious anomalies only when supported by the aggregate, common mistakes, discussion questions, interventions, and exactly one summary for every supplied profile type. Use the named performance metric when available. Do not imply causation from correlation, invent thresholds, or speculate about individual students or stores. Call out uncertainty and small samples. Never include identities or reconstruct individual results.",
      },
      {
        role: "user",
        content: JSON.stringify(aggregate),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "teacher_challenge_debrief",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "summary",
            ...DEBRIEF_ARRAY_FIELDS,
            "profileTypeSummaries",
          ],
          properties: {
            summary: { type: "string" },
            strongerPatterns: { type: "array", items: { type: "string" } },
            weakerPatterns: { type: "array", items: { type: "string" } },
            expectedVariation: { type: "array", items: { type: "string" } },
            suspiciousAnomalies: { type: "array", items: { type: "string" } },
            commonMistakes: { type: "array", items: { type: "string" } },
            discussionQuestions: { type: "array", items: { type: "string" } },
            suggestedInterventions: { type: "array", items: { type: "string" } },
            profileTypeSummaries: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "key",
                  "label",
                  "participantCount",
                  "summary",
                  "strengths",
                  "risks",
                  "recommendedFocus",
                ],
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  participantCount: { type: "number" },
                  summary: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "string" } },
                  recommendedFocus: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  };
}

function cleanString(value, maxLength = 2000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringArray(value, maxItems = 8) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item, 600)).filter(Boolean).slice(0, maxItems)
    : [];
}

function fallbackProfileTypeSummary(group, performanceMetric) {
  const metric = performanceMetric
    ? group.metrics?.[performanceMetric.key]
    : null;
  const metricText = metric
    ? ` ${metric.label} averaged ${metric.average} (range ${metric.min}–${metric.max}).`
    : "";
  return `${group.count} result${group.count === 1 ? "" : "s"} were available.${metricText}`;
}

function normalizeDebrief(value, aggregate) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = { summary: value };
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) parsed = {};

  const normalized = {
    summary: cleanString(parsed.summary) || NO_RESULTS_SUMMARY,
  };
  for (const field of DEBRIEF_ARRAY_FIELDS) {
    normalized[field] = cleanStringArray(parsed[field]);
  }

  const suppliedSummaries = Array.isArray(parsed.profileTypeSummaries)
    ? parsed.profileTypeSummaries
    : [];
  normalized.profileTypeSummaries = aggregate.profileTypeGroups.map((group) => {
    const supplied = suppliedSummaries.find((item) =>
      String(item?.key || "").toLowerCase() ===
        String(group.profileTypeKey || "").toLowerCase() ||
      String(item?.label || "").toLowerCase() ===
        String(group.profileType || "").toLowerCase(),
    ) || {};
    return {
      key: String(group.profileTypeKey || ""),
      label: String(group.profileType || "Unspecified profile type"),
      participantCount: group.count,
      summary:
        cleanString(supplied.summary, 1200) ||
        fallbackProfileTypeSummary(group, aggregate.performanceMetric),
      strengths: cleanStringArray(supplied.strengths, 5),
      risks: cleanStringArray(supplied.risks, 5),
      recommendedFocus: cleanStringArray(supplied.recommendedFocus, 5),
    };
  });
  return normalized;
}

function emptyDebrief(aggregate = null) {
  return {
    summary: NO_RESULTS_SUMMARY,
    ...Object.fromEntries(DEBRIEF_ARRAY_FIELDS.map((field) => [field, []])),
    profileTypeSummaries: (aggregate?.profileTypeGroups || []).map((group) => ({
      key: String(group.profileTypeKey || ""),
      label: String(group.profileType || "Unspecified profile type"),
      participantCount: group.count,
      summary: fallbackProfileTypeSummary(group, aggregate.performanceMetric),
      strengths: [],
      risks: [],
      recommendedFocus: [],
    })),
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
  })
    .select("+teacherDebrief")
    .lean();
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
  )
    .select("+teacherDebrief")
    .lean();

  if (!claimed) {
    const current = await Challenge.findOne({
      _id: challengeId,
      organization: organizationId,
    })
      .select("+teacherDebrief")
      .lean();
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
    let debrief = emptyDebrief(aggregate);
    if (aggregate.totalResults > 0) {
      const response = await openaiClient.chat.completions.create(
        buildOpenAIRequest(aggregate),
      );
      const content = response?.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenAI returned an empty challenge debrief");
      debrief = normalizeDebrief(content, aggregate);
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
          "teacherDebrief.summary": debrief.summary,
          "teacherDebrief.strongerPatterns": debrief.strongerPatterns,
          "teacherDebrief.weakerPatterns": debrief.weakerPatterns,
          "teacherDebrief.expectedVariation": debrief.expectedVariation,
          "teacherDebrief.suspiciousAnomalies": debrief.suspiciousAnomalies,
          "teacherDebrief.commonMistakes": debrief.commonMistakes,
          "teacherDebrief.discussionQuestions": debrief.discussionQuestions,
          "teacherDebrief.suggestedInterventions": debrief.suggestedInterventions,
          "teacherDebrief.profileTypeSummaries": debrief.profileTypeSummaries,
          "teacherDebrief.status": "completed",
          "teacherDebrief.generatedAt": generatedAt,
          "teacherDebrief.error": null,
        },
      },
      { new: true },
    )
      .select("+teacherDebrief")
      .lean();
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
  normalizeDebrief,
  emptyDebrief,
  generateChallengeDebrief,
  resetChallengeDebriefForRerun,
};
