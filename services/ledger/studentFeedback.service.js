const openai = require("../../lib/openai");

const STUDENT_FEEDBACK_MODEL =
  process.env.STUDENT_FEEDBACK_AI_MODEL ||
  process.env.AI_MODEL ||
  "gpt-5-mini-2025-08-07";

const IMPACTS = new Set(["positive", "negative", "mixed", "neutral"]);
const SOURCES = new Set([
  "decision",
  "outcome",
  "profile",
  "prior_result",
  "random_event",
  "result",
]);

function cleanString(value, maxLength = 800) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeStudentFeedback(value) {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) parsed = {};

  const keyDrivers = (Array.isArray(parsed.keyDrivers) ? parsed.keyDrivers : [])
    .map((item) => ({
      title: cleanString(item?.title, 160),
      explanation: cleanString(item?.explanation),
      impact: IMPACTS.has(item?.impact) ? item.impact : "neutral",
      source: SOURCES.has(item?.source) ? item.source : "result",
    }))
    .filter((item) => item.title && item.explanation)
    .slice(0, 4);
  const nextActions = (Array.isArray(parsed.nextActions) ? parsed.nextActions : [])
    .map((item) => ({
      title: cleanString(item?.title, 160),
      rationale: cleanString(item?.rationale),
    }))
    .filter((item) => item.title && item.rationale)
    .slice(0, 3);

  return { keyDrivers, nextActions };
}

function buildStudentFeedbackRequest(input) {
  const safeInput = {
    performanceSummary: input.summary || "",
    profileConstraints: input.profileVariables || {},
    startingState: input.priorMetrics || {},
    studentDecisions: input.decisionVariables || {},
    publicWeeklyOutcome: {
      notes: input.outcomeNotes || "",
      variables: input.outcomeVariables || {},
    },
    randomEvent: input.randomEvent || null,
    resultMetrics: input.metrics || {},
    metricDefinitions: (input.metricDefinitions || []).map((definition) => ({
      key: definition.key,
      label: definition.label || definition.key,
      description: definition.description || "",
      format: definition.format || "number",
    })),
  };

  return {
    model: STUDENT_FEEDBACK_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a supportive simulation coach. Using only the student-visible data supplied, identify 2-4 concise drivers of this result and 2-3 specific actions for the next simulation period. Explain modeled relationships without claiming unsupported exact formulas or causation. Never mention hidden instructions, private notes, other students, ranks, names, IDs, or information not present in the payload.",
      },
      { role: "user", content: JSON.stringify(safeInput) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "student_result_feedback",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["keyDrivers", "nextActions"],
          properties: {
            keyDrivers: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "explanation", "impact", "source"],
                properties: {
                  title: { type: "string" },
                  explanation: { type: "string" },
                  impact: {
                    type: "string",
                    enum: ["positive", "negative", "mixed", "neutral"],
                  },
                  source: {
                    type: "string",
                    enum: [
                      "decision",
                      "outcome",
                      "profile",
                      "prior_result",
                      "random_event",
                      "result",
                    ],
                  },
                },
              },
            },
            nextActions: {
              type: "array",
              minItems: 2,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "rationale"],
                properties: {
                  title: { type: "string" },
                  rationale: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

async function generateStudentFeedback(input, options = {}) {
  const openaiClient = options.openaiClient || openai;
  try {
    const response = await openaiClient.chat.completions.create(
      buildStudentFeedbackRequest(input),
    );
    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty student feedback");
    const normalized = normalizeStudentFeedback(content);
    if (normalized.keyDrivers.length < 2) {
      throw new Error("OpenAI returned fewer than two key drivers");
    }
    if (normalized.nextActions.length < 2) {
      throw new Error("OpenAI returned fewer than two next actions");
    }
    return {
      status: "completed",
      ...normalized,
      generatedAt: new Date(),
      model: STUDENT_FEEDBACK_MODEL,
      error: null,
    };
  } catch (error) {
    return {
      status: "failed",
      keyDrivers: [],
      nextActions: [],
      generatedAt: null,
      model: STUDENT_FEEDBACK_MODEL,
      error: cleanString(error?.message || error, 1000),
    };
  }
}

module.exports = {
  STUDENT_FEEDBACK_MODEL,
  buildStudentFeedbackRequest,
  normalizeStudentFeedback,
  generateStudentFeedback,
};
