function clampNumber(def, value) {
  if (def.dataType !== "number") return value;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return value;
  let v = num;
  if (def.min !== null && def.min !== undefined) v = Math.max(v, def.min);
  if (def.max !== null && def.max !== undefined) v = Math.min(v, def.max);
  return v;
}

module.exports = clampNumber;
