const openai = require("../../lib/openai");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");

function coerceValue(def, value) {
  if (value === undefined || value === null) return value;

  switch (def.dataType) {
    case "number": {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num)) return value;
      return num;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }
    case "string": {
      return typeof value === "string" ? value : String(value);
    }
    case "select": {
      // Keep as-is; may be string/number depending on options
      return value;
    }
    default:
      return value;
  }
}

function clampNumber(def, value) {
  if (def.dataType !== "number") return value;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return value;
  let v = num;
  if (def.min !== null && def.min !== undefined) v = Math.max(v, def.min);
  if (def.max !== null && def.max !== undefined) v = Math.min(v, def.max);
  return v;
}

function normalizeSelectAllowedValues(def) {
  const raw = Array.isArray(def.options) ? def.options : [];
  return raw
    .map((opt) => {
      if (opt && typeof opt === "object") {
        return opt.value !== undefined ? opt.value : opt.label;
      }
      return opt;
    })
    .filter((v) => v !== undefined && v !== null);
}

function buildJsonSchemaFromDefinitions(definitions) {
  const properties = {};
  const required = [];

  for (const def of definitions) {
    required.push(def.key);

    if (def.dataType === "number") {
      properties[def.key] = {
        type: "number",
        description: def.description || def.label || def.key,
        ...(def.min !== null && def.min !== undefined
          ? { minimum: def.min }
          : {}),
        ...(def.max !== null && def.max !== undefined
          ? { maximum: def.max }
          : {}),
      };
      continue;
    }

    if (def.dataType === "boolean") {
      properties[def.key] = {
        type: "boolean",
        description: def.description || def.label || def.key,
      };
      continue;
    }

    if (def.dataType === "select") {
      const allowedValues = normalizeSelectAllowedValues(def);
      properties[def.key] = {
        // Don’t set type too strictly; enum is the real constraint.
        description: def.description || def.label || def.key,
        ...(allowedValues.length > 0 ? { enum: allowedValues } : {}),
      };
      continue;
    }

    // default: string
    properties[def.key] = {
      type: "string",
      description: def.description || def.label || def.key,
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function fillMissingWithDefaults(definitions, values) {
  const out = { ...(values || {}) };

  for (const def of definitions) {
    if (
      out[def.key] !== undefined &&
      out[def.key] !== null &&
      out[def.key] !== ""
    ) {
      continue;
    }

    if (def.defaultValue !== null && def.defaultValue !== undefined) {
      out[def.key] = def.defaultValue;
      continue;
    }

    // Strong fallback to ensure every key is present
    if (def.dataType === "number") out[def.key] = 0;
    else if (def.dataType === "boolean") out[def.key] = false;
    else if (def.dataType === "select") {
      const allowed = normalizeSelectAllowedValues(def);
      out[def.key] = allowed.length > 0 ? allowed[0] : "";
    } else out[def.key] = "";
  }

  return out;
}

/**
 * Generate a fully-filled submission variables object for a given storeType + scenario.
 * Uses a cheap OpenAI model with structured JSON schema output.
 *
 * @param {Object} params
 * @param {string} params.classroomId
 * @param {string} params.storeTypeKey
 * @param {Object} [params.storeTypeVariables]
 * @param {Object} params.scenario
 * @param {string} params.organizationId
 * @param {string} params.clerkUserId
 * @param {string} params.model
 * @param {string} [params.absentPunishmentLevel] - Optional: "high", "medium", "low" to indicate student was absent
 */
async function generateSubmissionVariablesForStoreType({
  classroomId,
  storeTypeKey,
  storeTypeVariables,
  scenario,
  organizationId,
  clerkUserId,
  model,
  absentPunishmentLevel,
}) {
  const definitions = await VariableDefinition.getDefinitionsForScope(
    classroomId,
    "submission"
  );

  if (!definitions || definitions.length === 0) {
    throw new Error("No submission variable definitions found for classroom");
  }

  const jsonSchema = buildJsonSchemaFromDefinitions(definitions);

  const promptPayload = {
    storeType: storeTypeKey,
    // include a small subset of storeType signals (avoid huge payloads)
    storeTypeVariables: storeTypeVariables
      ? {
          startingBalance: storeTypeVariables.startingBalance,
          startingInventory: storeTypeVariables.startingInventory,
          maxDailyCapacity: storeTypeVariables.maxDailyCapacity,
          weeklyRent: storeTypeVariables.weeklyRent,
          fulfillmentModel: storeTypeVariables.fulfillmentModel,
        }
      : null,
    scenario: scenario
      ? {
          title: scenario.title,
          week: scenario.week,
          variables: scenario.variables || {},
        }
      : null,
    submissionVariablesToFill: definitions.map((d) => ({
      key: d.key,
      dataType: d.dataType,
      min: d.min,
      max: d.max,
      options:
        d.dataType === "select" ? normalizeSelectAllowedValues(d) : undefined,
      description: d.description || d.label || "",
    })),
    // Include absence punishment level if provided
    ...(absentPunishmentLevel && {
      studentWasAbsent: true,
      absencePunishmentLevel: absentPunishmentLevel,
    }),
  };

  // Build system message with absence punishment context if applicable
  let systemMessages = [
    "You generate realistic, conservative weekly student decisions (submission variables) for SCALE.ai (pizza shop supply chain simulation).",
    "Return ONLY JSON that matches the provided schema.",
    "Values must be plausible and within min/max constraints and enums.",
  ];

  if (absentPunishmentLevel) {
    const punishmentGuidance = {
      high: "The student was absent and should receive significantly negative outcomes. Generate decisions that will result in poor performance (e.g., low production, insufficient staffing, poor inventory management). The store should be heavily penalized for the absence.",
      medium:
        "The student was absent and should receive moderately negative outcomes. Generate decisions that will result in below-average performance. The store should be penalized for the absence but not severely.",
      low: "The student was absent and should receive slightly negative outcomes. Generate decisions that will result in slightly below-average performance. The store should be mildly penalized for the absence.",
    };

    systemMessages.push(
      `IMPORTANT: The student was ABSENT for this scenario. ${punishmentGuidance[absentPunishmentLevel] || punishmentGuidance.medium}`
    );
  }

  const system = systemMessages.join("\n");

  const response = await openai.chat.completions.create({
    model: model || process.env.AUTO_SUBMISSION_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 600,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          "Generate submission variable values for ONE student based on the following context:\n" +
          JSON.stringify(promptPayload, null, 2),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "submission_variables",
        schema: jsonSchema,
      },
    },
  });

  const content = response.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse OpenAI submission JSON: ${e.message}`);
  }

  // Coerce + clamp where possible
  const coerced = {};
  for (const def of definitions) {
    coerced[def.key] = clampNumber(def, coerceValue(def, parsed[def.key]));
  }

  const filled = fillMissingWithDefaults(definitions, coerced);

  // Validate using the same validation as the app (now supports object options)
  const validation = await VariableDefinition.validateValues(
    classroomId,
    "submission",
    filled
  );
  if (!validation.isValid) {
    throw new Error(
      `Auto-submission generation failed validation: ${validation.errors
        .map((e) => e.message)
        .join(", ")}`
    );
  }

  return filled;
}

module.exports = {
  generateSubmissionVariablesForStoreType,
};
