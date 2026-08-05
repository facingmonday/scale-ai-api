const normalizeSelectAllowedValues = require("./normalizeSelectAllowedValues");

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

module.exports = fillMissingWithDefaults;
