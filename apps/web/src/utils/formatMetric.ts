import type { MetricDefinition } from "../types/metric";

/**
 * Format a metric value for display based on the metric's format.
 */
export function formatMetricValue(
  value: unknown,
  definition: Pick<MetricDefinition, "format" | "dataType">
): string {
  if (value === null || value === undefined) return "—";

  const { format, dataType } = definition;

  if (dataType === "boolean") {
    return value ? "Yes" : "No";
  }

  if (dataType === "string") {
    return String(value);
  }

  // numeric values
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);

  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    case "percent":
      // For percent we assume decimal 0-1; otherwise display as-is
      if (Math.abs(num) <= 1) {
        return `${(num * 100).toFixed(1)}%`;
      }
      return `${num.toFixed(1)}%`;
    case "count":
    case "units":
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }).format(num);
    case "text":
      return String(num);
    default:
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(num);
  }
}

/**
 * Sort metric definitions by sortOrder, falling back to label alphabetically.
 */
export function sortMetricDefinitions<T extends Pick<MetricDefinition, "sortOrder" | "label">>(
  defs: T[]
): T[] {
  return [...defs].sort((a, b) => {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return (a.label ?? "").localeCompare(b.label ?? "");
  });
}

/**
 * Filter metric definitions for a given display location (table/kpi/chart/leaderboard/detail).
 */
export function filterMetricsForDisplay<T extends Pick<MetricDefinition, "displayIn" | "isActive">>(
  defs: T[],
  location: "table" | "kpi" | "chart" | "leaderboard" | "detail"
): T[] {
  return defs.filter((d) => d.isActive !== false && d.displayIn?.[location]);
}

/**
 * Extract a metric value from a LedgerEntry's dynamic metrics map.
 */
export function getMetricValue(
  entry: { metrics?: Record<string, unknown> } | null | undefined,
  key: string
): unknown {
  if (!entry || !entry.metrics) return undefined;
  return entry.metrics[key];
}
