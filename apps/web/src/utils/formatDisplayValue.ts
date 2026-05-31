const DEFAULT_MAX_FRACTION_DIGITS = 2;

type Options = {
  maxFractionDigits?: number;
  emptyStringFallback?: string;
  nullishFallback?: string;
};

const isNumericString = (value: string): boolean => {
  // Allows: "123", "-123", "123.45", ".45" is intentionally NOT allowed
  // to avoid treating arbitrary strings as numbers too aggressively.
  return /^-?\d+(\.\d+)?$/.test(value.trim());
};

export function formatDisplayValue(
  value: unknown,
  options: Options = {}
): string {
  const {
    maxFractionDigits = DEFAULT_MAX_FRACTION_DIGITS,
    emptyStringFallback = "—",
    nullishFallback = "—",
  } = options;

  if (value === null || value === undefined) return nullishFallback;

  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: maxFractionDigits,
  });

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return nullishFallback;
    return formatter.format(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return emptyStringFallback;
    if (isNumericString(trimmed)) {
      const n = Number(trimmed);
      if (Number.isFinite(n)) return formatter.format(n);
    }
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}
