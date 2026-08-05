import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import classroomService from "../../services/classroom";
import { formatMetricValue } from "../../utils/formatMetric";
import type { MetricDefinition } from "../../types/metric";
import type { ClassDashboard } from "../../types/dashboard";

interface LeaderboardSnapshotProps {
  challengeId?: string | null;
  variant?: "student" | "teacher";
  dashboard?: ClassDashboard | null;
}

const LeaderboardSnapshot: React.FC<LeaderboardSnapshotProps> = ({
  challengeId,
  variant = "student",
  dashboard: dashboardProp,
}) => {
  const { activeClassroom } = useAuth();
  const [dashboard, setDashboard] = useState<ClassDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;

  useEffect(() => {
    if (dashboardProp !== undefined) {
      setDashboard(dashboardProp ?? null);
      setIsLoading(false);
      return;
    }

    if (!classroomId) {
      setDashboard(null);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch dashboard for top 3
        try {
          const data = await classroomService.getAdminDashboard(classroomId);
          setDashboard(data);
        } catch {
          setDashboard(null);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [classroomId, challengeId, variant, dashboardProp]);

  const leaderboard = React.useMemo(() => {
    const metric = dashboard?.leaderboardMetric ?? null;
    return {
      metric,
      metricLabel: metric ? metric.label : "Leaderboard",
      classAverage: null as number | null,
      rows: (dashboard?.leaderboardTop10 || []).map((r) => ({
        userId: r.userId,
        displayName: r.profileName,
        value: r.metricTotal,
      })),
    };
  }, [dashboard?.leaderboardTop10, dashboard?.leaderboardMetric]);

  const fakeDef: MetricDefinition | null = leaderboard.metric
    ? ({
        key: leaderboard.metric.key,
        label: leaderboard.metric.label,
        format: leaderboard.metric.format,
        dataType: "number",
      } as MetricDefinition)
    : null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="heading-md">Leaderboard</h2>
        <span className="text-text-muted text-sm">
          {leaderboard.metricLabel}
        </span>
      </div>

      {isLoading ? (
        <p className="text-text-muted text-sm">Loading leaderboard…</p>
      ) : leaderboard.rows.length === 0 ? (
        <p className="text-text-muted text-sm">
          {variant === "student"
            ? "Leaderboard will appear when your class starts posting results."
            : "No leaderboard data yet for this week."}
        </p>
      ) : (
        <>
          <div className="gap-2">
            {leaderboard.rows.map((row, idx) => (
              <div
                key={row.userId}
                className="flex w-full items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {idx + 1}. {row.displayName}
                  </div>
                </div>
                <div className="font-semibold tabular-nums">
                  {fakeDef
                    ? formatMetricValue(Number(row.value), fakeDef)
                    : Number(row.value).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          {variant === "student" && (
            <div className="student-dashboard-footnote mt-2">
              Top 3 shown. Your full rank will appear when available.
            </div>
          )}
          {typeof leaderboard.classAverage === "number" && fakeDef && (
            <div className="mt-4 rounded-md border border-ui-border bg-ui-muted px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Class average</span>
                <span className="font-medium">
                  {formatMetricValue(leaderboard.classAverage, fakeDef)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeaderboardSnapshot;
