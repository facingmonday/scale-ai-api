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

module.exports = coerceValue;
