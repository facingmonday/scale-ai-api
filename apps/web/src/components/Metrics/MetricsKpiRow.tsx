import React from "react";
import {
  Banknote,
  ChartNoAxesColumnIncreasing,
  Package,
  Percent,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
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

const getMetricIcon = (definition: MetricDefinition) => {
  switch (definition.key.replace(/[^a-z]/gi, "").toLowerCase()) {
    case "sales":
    case "unitssold":
      return Package;
    case "revenue":
      return Banknote;
    case "costs":
    case "totalcosts":
      return Receipt;
    case "profit":
    case "netprofit":
      return TrendingUp;
    case "cashbalance":
    case "cashafter":
      return Wallet;
    default:
      return definition.format === "currency"
        ? Banknote
        : definition.format === "percent"
          ? Percent
          : ChartNoAxesColumnIncreasing;
  }
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
    <div className="metrics-kpi-row">
      {kpiDefs.map((def) => {
        const Icon = getMetricIcon(def);
        const raw = getMetricValue(entry, def.key);
        const display =
          raw === undefined || raw === null
            ? emptyValue
            : formatMetricValue(raw, def);
        return (
          <div
            key={def.key}
            className="flex min-w-0 items-center gap-3 rounded-xl bg-card p-4 border border-card-border"
            title={def.description || def.label}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-blue dark:text-brand-teal">
              <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-text-muted text-xs uppercase tracking-wide">
                {def.label}
              </div>
              <div className="mt-1 break-words text-2xl font-semibold tabular-nums text-text-primary">
                {display}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MetricsKpiRow;
