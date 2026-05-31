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
  emptyValue?: string;
};

/**
 * Renders a horizontal row of KPI cards driven by MetricDefinitions
 * where displayIn.kpi === true.
 */
const MetricsKpiRow: React.FC<Props> = ({ entry, definitions, emptyValue = "—" }) => {
  const kpiDefs = sortMetricDefinitions(filterMetricsForDisplay(definitions, "kpi"));

  if (kpiDefs.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {kpiDefs.map((def) => {
        const raw = getMetricValue(entry, def.key);
        const display =
          raw === undefined || raw === null
            ? emptyValue
            : formatMetricValue(raw, def);
        return (
          <div
            key={def.key}
            className="rounded-lg bg-card p-4 border border-card-border"
            title={def.description || def.label}
          >
            <div className="text-text-muted text-xs uppercase tracking-wide">
              {def.label}
            </div>
            <div className="text-2xl font-semibold mt-1">{display}</div>
          </div>
        );
      })}
    </div>
  );
};

export default MetricsKpiRow;
