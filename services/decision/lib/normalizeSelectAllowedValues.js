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

module.exports = normalizeSelectAllowedValues;
