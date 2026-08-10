import React, { useMemo, useState } from "react";
import { Chart } from "primereact/chart";
import type { MetricDefinition } from "../../types/metric";
import type { LedgerEntry } from "../../types/ledger";
import {
  filterMetricsForDisplay,
  formatMetricValue,
  getMetricValue,
  sortMetricDefinitions,
} from "../../utils/formatMetric";

type Props = {
  entries: LedgerEntry[];
  definitions: MetricDefinition[];
  /** Initial metric key to chart (defaults to first chart-eligible metric) */
  initialKey?: string;
  /** Optional resolver for x-axis labels per entry */
  labelFor?: (entry: LedgerEntry, index: number) => string;
};

/**
 * Dynamic line chart driven by MetricDefinitions where displayIn.chart === true.
 * A select control lets the user pick which metric to chart.
 */
const MetricsChart: React.FC<Props> = ({
  entries,
  definitions,
  initialKey,
  labelFor,
}) => {
  const chartDefs = useMemo(
    () => sortMetricDefinitions(filterMetricsForDisplay(definitions, "chart")),
    [definitions]
  );

  const [selectedKey, setSelectedKey] = useState<string>(
    initialKey || chartDefs[0]?.key || ""
  );

  const selectedDef =
    chartDefs.find((definition) => definition.key === selectedKey) ||
    chartDefs.find((definition) => definition.key === initialKey) ||
    chartDefs[0];

  if (chartDefs.length === 0) {
    return (
      <div className="text-text-muted text-sm">
        No metrics configured for chart display.
      </div>
    );
  }

  if (!selectedDef) {
    return null;
  }

  // Entries are typically newest-first; reverse for chronological chart.
  const chronological = [...entries].reverse();

  const chartData = {
    labels: chronological.map((entry, index) =>
      labelFor ? labelFor(entry, index) : `#${index + 1}`
    ),
    datasets: [
      {
        label: selectedDef.label,
        data: chronological.map((entry) => {
          const v = getMetricValue(entry, selectedDef.key);
          const num = typeof v === "number" ? v : Number(v);
          return Number.isFinite(num) ? num : null;
        }),
        borderColor: "rgb(56, 178, 172)",
        backgroundColor: "rgba(56, 178, 172, 0.15)",
        tension: 0.3,
        fill: true,
        spanGaps: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => {
            if (ctx.parsed.y === null) return "—";
            return formatMetricValue(ctx.parsed.y, selectedDef);
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (val: string | number) =>
            formatMetricValue(Number(val), selectedDef),
        },
      },
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{selectedDef.label}</h3>
        <select
          className="input max-w-xs"
          value={selectedDef.key}
          onChange={(e) => setSelectedKey(e.target.value)}
        >
          {chartDefs.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ height: "260px" }}>
        <Chart type="line" data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default MetricsChart;
