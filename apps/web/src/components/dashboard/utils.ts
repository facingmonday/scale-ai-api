/**
 * Shared utility functions for dashboard components
 */

type ApiEnvelope<T> = { data?: T } | T;
type ScenarioLike = unknown;

export function unwrap<T>(payload: ApiEnvelope<T>): T {
  return (payload as { data?: T })?.data ?? (payload as T);
}

export function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatProfileType(
  profileType?:
    | string
    | { key?: string | null; label?: string | null }
    | null
): string {
  if (!profileType) return "";
  if (typeof profileType === "string") return profileType;
  if (typeof profileType === "object") {
    const label = (profileType as { label?: string | null }).label;
    if (label) return String(label);
    const key = (profileType as { key?: string | null }).key;
    if (key) return String(key);
  }
  return "";
}

export function normalizeScenarioTitle(s: ScenarioLike): string {
  if (s && typeof s === "object") {
    const obj = s as Record<string, unknown>;
    const title = "title" in obj ? obj.title : undefined;
    const name = "name" in obj ? obj.name : undefined;
    const candidate = title ?? name;
    if (candidate != null) {
      return String(candidate);
    }
  }
  return "This challenge";
}

export function normalizeScenarioDescription(s: ScenarioLike): string {
  if (s && typeof s === "object") {
    const obj = s as Record<string, unknown>;
    const description = "description" in obj ? obj.description : "";
    return String(description ?? "").trim();
  }
  return "";
}

export function normalizeScenarioId(s: ScenarioLike): string | null {
  if (s && typeof s === "object") {
    const obj = s as Record<string, unknown>;
    const id = "_id" in obj ? obj._id : "id" in obj ? obj.id : null;
    return id ? String(id) : null;
  }
  return null;
}

/**
 * Picks up to N decision-variable rows from a generic variables map for display.
 * Uses the variable definitions (if provided) to surface labels and ordering.
 */
export function pickDecisionRows(
  vars: Record<string, unknown> | undefined,
  definitions?: Array<{ key: string; label?: string; sortOrder?: number }>,
  max = 3
): Array<{ label: string; value: string }> {
  if (!vars) return [];

  if (definitions && definitions.length > 0) {
    const sortedDefs = [...definitions].sort((a, b) => {
      const ao = a.sortOrder ?? 0;
      const bo = b.sortOrder ?? 0;
      if (ao !== bo) return ao - bo;
      return (a.label || a.key).localeCompare(b.label || b.key);
    });
    const rows: Array<{ label: string; value: string }> = [];
    for (const def of sortedDefs) {
      if (rows.length >= max) break;
      if (Object.prototype.hasOwnProperty.call(vars, def.key)) {
        const v = vars[def.key];
        rows.push({
          label: def.label || def.key,
          value: typeof v === "object" ? JSON.stringify(v) : String(v),
        });
      }
    }
    if (rows.length > 0) return rows;
  }

  return Object.entries(vars)
    .slice(0, max)
    .map(([k, v]) => ({
      label: k,
      value: typeof v === "object" ? JSON.stringify(v) : String(v),
    }));
}
