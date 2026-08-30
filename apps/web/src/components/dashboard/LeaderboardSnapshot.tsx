import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import classroomService from "../../services/classroom";
import { formatMetricValue } from "../../utils/formatMetric";
import type { MetricDefinition } from "../../types/metric";
import type {
  ClassDashboard,
  LeaderboardCategory,
  LeaderboardEntry,
} from "../../types/dashboard";

interface LeaderboardSnapshotProps {
  challengeId?: string | null;
  variant?: "student" | "teacher";
  dashboard?: ClassDashboard | null;
}

function metricDefinitionFor(category: LeaderboardCategory): MetricDefinition {
  return {
    key: category.metric.key,
    label: category.metric.label,
    format: category.metric.format,
    aggregation: category.metric.aggregation ?? "sum",
    dataType: "number",
  } as MetricDefinition;
}

function displayRank(entries: LeaderboardEntry[], entry: LeaderboardEntry, index: number) {
  const rank = entry.rank ?? index + 1;
  const isTie = entry.isTied || entries.some(
    (candidate, candidateIndex) =>
      candidateIndex !== index && candidate.metricTotal === entry.metricTotal
  );
  return isTie ? `T-${rank}` : String(rank);
}

const LeaderboardSnapshot: React.FC<LeaderboardSnapshotProps> = ({
  challengeId,
  variant = "student",
  dashboard: dashboardProp,
}) => {
  const { activeClassroom } = useAuth();
  const [fetchedDashboard, setFetchedDashboard] =
    useState<ClassDashboard | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const classroomId = activeClassroom?._id ?? null;
  const dashboard =
    dashboardProp !== undefined ? dashboardProp : fetchedDashboard;
  const isLoading =
    dashboardProp === undefined && Boolean(classroomId) && isFetching;

  useEffect(() => {
    if (dashboardProp !== undefined || !classroomId) return;

    const fetchData = async () => {
      setIsFetching(true);
      try {
        setFetchedDashboard(
          await classroomService.getAdminDashboard(classroomId)
        );
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
        setFetchedDashboard(null);
      } finally {
        setIsFetching(false);
      }
    };

    void fetchData();
  }, [classroomId, challengeId, variant, dashboardProp]);

  const categories = useMemo<LeaderboardCategory[]>(() => {
    if (dashboard?.leaderboards?.length) return dashboard.leaderboards;
    if (!dashboard?.leaderboardMetric) return [];
    return [
      {
        metric: dashboard.leaderboardMetric,
        direction: "desc",
        entries: (dashboard.leaderboardTop10 || []).map((entry, index) => ({
          ...entry,
          rank: index + 1,
        })),
      },
    ];
  }, [dashboard]);

  return (
    <section className="w-full" aria-labelledby="leaderboard-heading">
      <div className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="leaderboard-heading" className="heading-lg">
            Leaderboard
          </h2>
          <span className="text-text-muted text-sm">Cumulative performance</span>
        </div>
        <p className="text-text-muted text-sm mt-1">
          Rankings include all challenge results for this classroom.
        </p>
      </div>

      {isLoading ? (
        <div className="card">
          <p className="text-text-muted text-sm">Loading leaderboards…</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="card">
          <p className="text-text-muted text-sm">
            {variant === "student"
              ? "Leaderboards will appear when your class starts posting results."
              : "No leaderboard data is configured for this classroom."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {categories.map((category) => {
            const definition = metricDefinitionFor(category);
            const entries =
              variant === "student"
                ? category.entries.slice(0, 3)
                : category.entries.slice(0, 5);
            return (
              <article key={category.metric.key} className="card min-w-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="heading-md truncate">{category.metric.label}</h3>
                    <p className="text-text-muted text-xs mt-1">
                      {category.direction === "asc" ? "Lowest wins" : "Highest wins"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-ui-muted px-2 py-1 text-text-muted text-xs">
                    Cumulative
                  </span>
                </div>

                {entries.length === 0 ? (
                  <p className="text-text-muted text-sm py-4">
                    No {category.metric.label.toLowerCase()} data yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry, index) => (
                      <div
                        key={`${category.metric.key}:${entry.userId}`}
                        className="flex w-full items-center justify-between gap-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-7 shrink-0 text-text-muted text-sm tabular-nums">
                            {displayRank(entries, entry, index)}.
                          </span>
                          <span className="font-medium truncate">
                            {entry.profileName}
                          </span>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatMetricValue(entry.metricTotal, definition)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default LeaderboardSnapshot;
