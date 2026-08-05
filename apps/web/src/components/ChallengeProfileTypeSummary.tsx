import React from "react";
import { useNavigate } from "react-router-dom";
import type { StoreTypeStat } from "@/types/challenge";
import type { MetricDefinition } from "@/types/metric";
import {
  formatMetricValue,
  sortMetricDefinitions,
} from "@/utils/formatMetric";

interface ScenarioStoreTypeSummaryProps {
  profileType: string;
  stats: StoreTypeStat;
  storeTypeLabelMap: Record<string, string>;
  metricDefinitions?: MetricDefinition[];
}

const ScenarioStoreTypeSummary: React.FC<ScenarioStoreTypeSummaryProps> = ({
  profileType,
  stats,
  storeTypeLabelMap,
  metricDefinitions = [],
}) => {
  const navigate = useNavigate();

  const handleClick = (decisionId: string) => {
    navigate(`/decisions/${decisionId}`);
  };

  const numericDefs = sortMetricDefinitions(
    metricDefinitions.filter(
      (md) => md.dataType === "number" && md.isActive !== false
    )
  ).slice(0, 4);

  const primaryDef =
    numericDefs.find((md) => md.displayIn?.leaderboard) || numericDefs[0];

  return (
    <div className="border-1 border-ui-border rounded-xl p-6 bg-gradient-to-br from-ui-surface to-ui-muted/30 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="heading-md text-text-primary">
          {storeTypeLabelMap[profileType] || profileType}
        </h3>
        <span className="badge-success text-xs px-2 py-1">
          {stats.count} profiles
        </span>
      </div>

      {numericDefs.length > 0 && (
        <>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-4">
              <i className="pi pi-calculator text-brand-teal" />
              <h4 className="text-base font-semibold text-text-primary">
                Totals
              </h4>
            </div>
            <div className="flex flex-wrap gap-4">
              {numericDefs.map((def) => (
                <div
                  key={def.key}
                  className="flex-1 min-w-0 basis-[calc(50%-0.5rem)] md:basis-[calc(25%-0.75rem)] bg-ui-surface rounded-lg p-4 border border-ui-border"
                >
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    {def.label}
                  </div>
                  <div className="text-xl font-bold text-text-primary">
                    {formatMetricValue(stats.totals[def.key] ?? 0, def)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-4">
              <i className="pi pi-chart-pie text-brand-orange" />
              <h4 className="text-base font-semibold text-text-primary">
                Averages
              </h4>
            </div>
            <div className="flex flex-wrap gap-4">
              {numericDefs.map((def) => (
                <div
                  key={def.key}
                  className="flex-1 min-w-0 basis-[calc(50%-0.5rem)] md:basis-[calc(25%-0.75rem)] bg-ui-surface rounded-lg p-4 border border-ui-border"
                >
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    {def.label}
                  </div>
                  <div className="text-xl font-bold text-text-primary">
                    {formatMetricValue(stats.averages[def.key] ?? 0, def)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {stats.winners && stats.winners.length > 0 && primaryDef && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <i className="pi pi-trophy text-yellow-500" />
            <h4 className="text-base font-semibold text-text-primary">
              Top Performers
            </h4>
          </div>
          <div className="space-y-1.5">
            {stats.winners.map((winner, idx) => (
              <div
                key={idx}
                onClick={() => handleClick(winner.decisionId)}
                className="flex items-center justify-between px-3 py-2 bg-green-50/50 hover:bg-green-50 rounded-md border border-green-200/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-bold text-green-600 w-4 flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="text-sm font-medium text-text-primary truncate">
                    {winner.userId.firstName} {winner.userId.lastName}
                  </span>
                  <span className="text-xs text-text-muted truncate">
                    {winner.profile.shopName}
                  </span>
                </div>
                <span className="text-sm font-bold text-green-600">
                  {formatMetricValue(winner.primaryMetricValue, primaryDef)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.losers && stats.losers.length > 0 && primaryDef && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <i className="pi pi-exclamation-triangle text-orange-500" />
            <h4 className="text-base font-semibold text-text-primary">
              Lowest Performers
            </h4>
          </div>
          <div className="space-y-1.5">
            {stats.losers.map((loser, idx) => (
              <div
                key={idx}
                onClick={() => handleClick(loser.decisionId)}
                className="flex items-center justify-between px-3 py-2 bg-red-50/50 hover:bg-red-50 rounded-md border border-red-200/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-bold text-red-600 w-4 flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="text-sm font-medium text-text-primary truncate">
                    {loser.userId.firstName} {loser.userId.lastName}
                  </span>
                  <span className="text-xs text-text-muted truncate">
                    {loser.profile.shopName}
                  </span>
                </div>
                <span className="text-sm font-bold text-red-600">
                  {formatMetricValue(loser.primaryMetricValue, primaryDef)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioStoreTypeSummary;
