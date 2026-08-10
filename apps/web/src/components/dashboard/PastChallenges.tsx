import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import challengeService from "../../services/challenge";
import { unwrap } from "./utils";
import type { Challenge } from "@/types/challenge";
import type { StudentDashboardResult } from "@/types/dashboard";
import type { MetricDefinition } from "@/types/metric";
import {
  filterMetricsForDisplay,
  formatMetricValue,
  sortMetricDefinitions,
} from "@/utils/formatMetric";

interface PastScenariosProps {
  currentScenarioId?: string | null;
  variant?: "student" | "teacher";
  limit?: number;
  onRerun?: (challengeId: string) => Promise<void>;
  results?: StudentDashboardResult[];
  metricDefinitions?: MetricDefinition[];
}

const PastScenarios: React.FC<PastScenariosProps> = ({
  currentScenarioId,
  variant = "student",
  results = [],
  metricDefinitions = [],
}) => {
  const { activeClassroom } = useAuth();
  const navigate = useNavigate();
  const [challenges, setScenarios] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;

  useEffect(() => {
    if (!classroomId) {
      setScenarios([]);
      setIsLoading(false);
      return;
    }

    const fetchScenarios = async () => {
      setIsLoading(true);
      try {
        const response = await challengeService.getAll(
          classroomId,
          variant === "teacher" ? "admin" : "student"
        );
        const list = unwrap(response) as Challenge[];
        setScenarios(list);
      } catch (err) {
        console.error("Failed to fetch challenges:", err);
        setScenarios([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchScenarios();
  }, [classroomId, currentScenarioId, variant]);

  if (variant === "student") {
    const resultMap = new Map(
      results.map((result) => [result.challengeId, result])
    );
    const historyDefinitions = sortMetricDefinitions(
      filterMetricsForDisplay(metricDefinitions, "kpi")
    ).slice(0, 3);
    const pastChallenges = currentScenarioId
      ? challenges.filter(
          (challenge) =>
            String(challenge._id ?? challenge.id) !== currentScenarioId
        )
      : challenges;

    return (
      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
              Your history
            </div>
            <h2 className="mt-1 text-xl font-bold text-text-primary">
              Previous challenges
            </h2>
          </div>
          <span className="text-sm text-text-muted">
            {pastChallenges.length}{" "}
            {pastChallenges.length === 1 ? "week" : "weeks"}
          </span>
        </div>
        {isLoading ? (
          <p className="text-text-muted text-sm">Loading challenges…</p>
        ) : pastChallenges.length === 0 ? (
          <p className="text-text-muted text-sm">No past challenges yet.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pastChallenges.map((s: Challenge) => {
              const challengeId = String(s?._id ?? s?.id);
              const result = resultMap.get(challengeId);

              return (
                <button
                  key={challengeId}
                  type="button"
                  className="group block w-full max-w-full overflow-hidden rounded-xl border border-ui-border bg-ui-surface p-4 text-left transition-all hover:border-brand-teal/40 hover:shadow-sm"
                  onClick={() => {
                    if (challengeId) navigate(`/challenges/${challengeId}`);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-text-primary group-hover:text-brand-teal">
                        {s?.title}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {s.createdDate
                          ? new Date(s.createdDate).toLocaleDateString()
                          : s?.isClosed
                            ? "Completed"
                            : "Active"}
                      </div>
                    </div>
                    <span
                      className={
                        result
                          ? "badge-success"
                          : "badge bg-ui-muted text-text-secondary"
                      }
                    >
                      {result
                        ? "Results"
                        : s?.isClosed
                          ? "Closed"
                          : "Active"}
                    </span>
                  </div>

                  {result && historyDefinitions.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ui-border pt-3">
                      {historyDefinitions.map((definition) => (
                        <div key={definition.key} className="min-w-0">
                          <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                            {definition.label}
                          </div>
                          <div className="mt-1 truncate text-sm font-bold text-text-primary">
                            {formatMetricValue(
                              result.metrics[definition.key],
                              definition
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Teacher variant
  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h2 className="heading-md">Past Challenges</h2>
        <button
          type="button"
          className="btn-outline w-full sm:w-auto"
          onClick={() => navigate("/challenges")}
        >
          View all
        </button>
      </div>

      {isLoading ? (
        <p className="text-text-muted mt-3">Loading challenges…</p>
      ) : challenges.length === 0 ? (
        <p className="text-text-muted mt-3">No past challenges yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {challenges.map((s: Challenge) => {
            const statusLabel = !s.isPublished
              ? "Draft"
              : s.isClosed
              ? "Closed"
              : "Published";
            return (
              <div
                key={s._id}
                className="flex items-start justify-between gap-3 rounded-md border border-ui-border bg-ui-surface px-4 py-3 overflow-hidden"
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <button
                    type="button"
                    className="font-medium text-left hover:underline truncate block w-full"
                    onClick={() => navigate(`/challenges/${s._id}`)}
                  >
                    {s?.title}
                  </button>
                  <div className="text-sm text-text-muted truncate">
                    {s.createdDate
                      ? new Date(s.createdDate).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="badge bg-ui-muted text-text-secondary whitespace-nowrap">
                    {statusLabel}
                  </span>
                  {s.isClosed && (
                    <button
                      type="button"
                      className="btn-outline whitespace-nowrap"
                      onClick={async () => {
                        const ok = window.confirm(
                          "Rerun this challenge? This may overwrite existing results."
                        );
                        if (!ok) return;
                      }}
                    >
                      Rerun
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PastScenarios;
