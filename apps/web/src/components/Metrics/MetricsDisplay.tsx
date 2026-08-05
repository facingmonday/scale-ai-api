import React from "react";
import type { MetricDefinition } from "../../types/metric";
import type { LedgerEntry } from "../../types/ledger";
import {
  filterMetricsForDisplay,
  formatMetricValue,
  getMetricValue,
  sortMetricDefinitions,
} from "../../utils/formatMetric";

type Props = {
  entry: LedgerEntry | null | undefined;
  definitions: MetricDefinition[];
  /** Show metrics flagged for detail or all metrics? */
  scope?: "detail" | "table" | "kpi" | "all";
  /** Optional className for the outer container */
  className?: string;
};

/**
 * Vertical key/value rendering of a ledger entry's dynamic metrics.
 * Useful for detail panels, modals, and read-only summaries.
 */
const MetricsDisplay: React.FC<Props> = ({
  entry,
  definitions,
  scope = "detail",
  className,
}) => {
  const defs = sortMetricDefinitions(
    scope === "all"
      ? definitions.filter((d) => d.isActive !== false)
      : filterMetricsForDisplay(definitions, scope)
  );

  if (defs.length === 0) {
    return (
      <div className="text-text-muted text-sm">
        No metrics configured for display.
      </div>
    );
  }

  return (
    <div className={`flex flex-col divide-y divide-card-border ${className ?? ""}`}>
      {defs.map((def) => {
        const raw = getMetricValue(entry, def.key);
        const display =
          raw === undefined || raw === null
            ? "—"
            : formatMetricValue(raw, def);
        return (
          <div
            key={def.key}
            className="flex items-start justify-between py-2 gap-4"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" title={def.label}>
                {def.label}
              </div>
              {def.description && (
                <div className="text-text-muted text-xs">{def.description}</div>
              )}
            </div>
            <div className="text-sm whitespace-nowrap font-mono">{display}</div>
          </div>
        );
      })}
    </div>
  );
};

export default MetricsDisplay;
