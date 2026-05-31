import React from "react";
import type { MetricDefinition } from "../../types/metric";
import type { LedgerEntry } from "../../types/ledger";
import {
  filterMetricsForDisplay,
  formatMetricValue,
  getMetricValue,
  sortMetricDefinitions,
} from "../../utils/formatMetric";

type RowMeta = {
  label: string;
  sublabel?: string;
};

type Props = {
  entries: LedgerEntry[];
  definitions: MetricDefinition[];
  /** Optional resolver to derive the leftmost row label/sublabel from each entry. */
  rowMeta?: (entry: LedgerEntry, index: number) => RowMeta;
  /** Optional click handler for a row. */
  onRowClick?: (entry: LedgerEntry) => void;
  /** Show a "Period" leftmost label column when no rowMeta resolver provided. */
  periodColumnLabel?: string;
};

/**
 * Dynamic ledger table — one column per active table metric.
 * Each row is a LedgerEntry; metric cells use `formatMetricValue`.
 */
const MetricsTable: React.FC<Props> = ({
  entries,
  definitions,
  rowMeta,
  onRowClick,
  periodColumnLabel = "Period",
}) => {
  const tableDefs = sortMetricDefinitions(
    filterMetricsForDisplay(definitions, "table")
  );

  if (tableDefs.length === 0) {
    return (
      <div className="text-text-muted text-sm">
        No metrics configured for table display.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-muted border-b border-card-border">
            <th className="py-2 pr-4">{periodColumnLabel}</th>
            {tableDefs.map((def) => (
              <th key={def.key} className="py-2 pr-4 whitespace-nowrap">
                {def.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const meta: RowMeta = rowMeta
              ? rowMeta(entry, index)
              : { label: `#${entries.length - index}` };
            return (
              <tr
                key={entry._id || index}
                className={`border-b border-card-border ${
                  onRowClick ? "cursor-pointer hover:bg-card-hover" : ""
                }`}
                onClick={() => onRowClick?.(entry)}
              >
                <td className="py-2 pr-4">
                  <div className="font-medium">{meta.label}</div>
                  {meta.sublabel && (
                    <div className="text-text-muted text-xs">{meta.sublabel}</div>
                  )}
                </td>
                {tableDefs.map((def) => {
                  const raw = getMetricValue(entry, def.key);
                  return (
                    <td key={def.key} className="py-2 pr-4 whitespace-nowrap">
                      {raw === undefined || raw === null
                        ? "—"
                        : formatMetricValue(raw, def)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td
                colSpan={tableDefs.length + 1}
                className="py-6 text-center text-text-muted"
              >
                No ledger entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MetricsTable;
