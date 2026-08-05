const normalizeSelectAllowedValues = require("./normalizeSelectAllowedValues");

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

module.exports = buildJsonSchemaFromDefinitions;
