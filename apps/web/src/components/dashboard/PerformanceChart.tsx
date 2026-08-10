import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useUser } from "@clerk/clerk-react";
import ledgerService from "../../services/ledger";
import { unwrap, normalizeScenarioTitle } from "./utils";
import type { LedgerEntry } from "../../types/ledger";
import type { MetricDefinition } from "../../types/metric";
import type { StudentDashboardResult } from "../../types/dashboard";
import MetricsChart from "../Metrics/MetricsChart";

type LedgerEntryWithDates = LedgerEntry & {
  createdDate?: string | Date;
  challengeId?: unknown;
};

/**
 * Dashboard performance chart — fully dynamic now.
 * Users can pick which metric to chart from any metric defined for `displayIn.chart === true`.
 */
interface PerformanceChartProps {
  results?: StudentDashboardResult[];
  definitions?: MetricDefinition[];
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  results,
  definitions,
}) => {
  const { activeClassroom } = useAuth();
  const { user } = useUser();
  const [ledgerHistory, setLedgerHistory] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;
  const metricDefinitions =
    definitions ?? activeClassroom?.metricDefinitions ?? [];

  useEffect(() => {
    if (results !== undefined) {
      return;
    }

    if (!classroomId || !user?.id) {
      return;
    }

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const historyRes = await ledgerService.getHistoryForUser(
          classroomId,
          user.id
        );
        const history = unwrap(historyRes) as LedgerEntry[];
        setLedgerHistory(Array.isArray(history) ? history : []);
      } catch (err) {
        console.error("Failed to fetch ledger history:", err);
        setLedgerHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchHistory();
  }, [classroomId, results, user?.id]);

  const resultEntries = useMemo(
    () =>
      (results ?? []).map(
        (result) =>
          ({
            metrics: result.metrics,
            createdDate: result.completedAt,
            challengeId: { title: result.title },
          }) as unknown as LedgerEntry
      ),
    [results]
  );
  const canLoadHistory = Boolean(classroomId && user?.id);
  const entries = useMemo(
    () =>
      results !== undefined
        ? resultEntries
        : canLoadHistory
          ? ledgerHistory
          : [],
    [canLoadHistory, ledgerHistory, resultEntries, results]
  );

  // Sort newest-first (MetricsChart reverses internally to chronological)
  const sortedHistory = useMemo(() => {
    return [...entries]
      .filter((e) => (e as LedgerEntryWithDates).createdDate != null)
      .sort((a, b) => {
        const dateA = new Date((a as LedgerEntryWithDates).createdDate || 0).getTime();
        const dateB = new Date((b as LedgerEntryWithDates).createdDate || 0).getTime();
        return dateB - dateA;
      });
  }, [entries]);

  const labelFor = (entry: LedgerEntry, index: number): string => {
    const challengeId = (entry as LedgerEntryWithDates).challengeId;
    if (
      challengeId &&
      typeof challengeId === "object" &&
      "title" in challengeId
    ) {
      return normalizeScenarioTitle(challengeId);
    }
    if (typeof challengeId === "string" && challengeId) {
      return `Challenge ${challengeId.slice(-4)}`;
    }
    return `#${index + 1}`;
  };

  if (results === undefined && canLoadHistory && isLoading) {
    return (
      <div className="card">
        <p className="text-text-muted">Loading performance data...</p>
      </div>
    );
  }

  if (sortedHistory.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="heading-md">Performance Over Time</h2>
        <span className="text-text-muted text-sm">
          {sortedHistory.length}{" "}
          {sortedHistory.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <MetricsChart
        entries={sortedHistory}
        definitions={metricDefinitions}
        labelFor={labelFor}
      />
    </div>
  );
};

export default PerformanceChart;
