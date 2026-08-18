import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type {
  StudentClassStatistics,
  StudentDashboardResponse,
} from "../../types/dashboard";
import type { LedgerEntry } from "../../types/ledger";
import type { MetricDefinition } from "../../types/metric";
import MetricsKpiRow from "../Metrics/MetricsKpiRow";
import {
  filterMetricsForDisplay,
  formatMetricValue,
  sortMetricDefinitions,
} from "../../utils/formatMetric";
import { formatProfileType } from "./utils";

interface StudentDashboardInsightsProps {
  dashboard: StudentDashboardResponse;
}

const ComparisonCard: React.FC<{
  definition: MetricDefinition;
  statistics: StudentClassStatistics;
}> = ({ definition, statistics }) => {
  const rawStudentValue = Number(statistics.studentMetrics[definition.key]);
  const studentValue = Number.isFinite(rawStudentValue) ? rawStudentValue : 0;
  const classAverage = statistics.averages[definition.key] ?? 0;
  const difference = studentValue - classAverage;

  return (
    <div className="rounded-xl border border-ui-border bg-ui-surface p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {definition.label}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-text-muted">Your result</div>
          <div className="mt-1 text-lg font-bold text-text-primary">
            {formatMetricValue(studentValue, definition)}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Class average</div>
          <div className="mt-1 text-lg font-semibold text-text-secondary">
            {formatMetricValue(classAverage, definition)}
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs font-medium text-text-muted">
        {formatMetricValue(Math.abs(difference), definition)} {difference >= 0 ? "above" : "below"} class average
      </div>
    </div>
  );
};

const StudentDashboardInsights: React.FC<StudentDashboardInsightsProps> = ({
  dashboard,
}) => {
  const navigate = useNavigate();
  const profile = dashboard.profile;
  const latestResult = dashboard.latestResult;
  const statistics = dashboard.classStatistics;
  const metricDefinitions = dashboard.metricDefinitions;

  const comparisonDefinitions = useMemo(() => {
    const kpis = sortMetricDefinitions(
      filterMetricsForDisplay(metricDefinitions, "kpi").filter(
        (definition) => definition.dataType === "number"
      )
    );
    return (kpis.length > 0
      ? kpis
      : metricDefinitions.filter(
          (definition) => definition.dataType === "number"
        )
    ).slice(0, 4);
  }, [metricDefinitions]);

  const latestEntry = latestResult
    ? ({ metrics: latestResult.metrics } as LedgerEntry)
    : null;
  const profileType =
    profile?.profileType && typeof profile.profileType === "object"
      ? profile.profileType.label || profile.profileType.key
      : formatProfileType(profile?.profileType);
  const statusLabel = dashboard.activeScenario
    ? "Challenge in progress"
    : dashboard.recentResults.length === 0
      ? "Ready for your first challenge"
      : "All caught up";

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-brand-teal/20 bg-gradient-to-br from-brand-teal/10 via-ui-surface to-brand-blue/5 p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {profile?.imageUrl ? (
              <img
                src={profile.imageUrl}
                alt={profile.shopName || "Student profile"}
                className="h-20 w-20 flex-shrink-0 rounded-2xl border border-ui-border object-cover shadow-sm"
              />
            ) : (
              <div
                className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-brand-teal/40 bg-brand-teal/10 text-2xl text-brand-teal"
                aria-label="Profile image placeholder"
              >
                <i className="pi pi-user" aria-hidden />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-brand-teal">
                {dashboard.className}
              </div>
              <h1 className="mt-1 truncate text-2xl font-bold text-text-primary md:text-3xl">
                {profile?.shopName || "Create your student profile"}
              </h1>
              {!profile ? (
                <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <p className="max-w-xl text-sm text-text-muted">
                    Set up your shop profile to personalize your dashboard and
                    participate in class challenges.
                  </p>
                  <button
                    type="button"
                    className="btn-teal flex-shrink-0"
                    onClick={() => navigate("/profile")}
                  >
                    Create Profile
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                  {profileType && (
                    <span className="rounded-full bg-ui-surface px-3 py-1 ring-1 ring-ui-border">
                      {profileType}
                    </span>
                  )}
                  {profile.studentId && (
                    <span className="rounded-full bg-ui-surface px-3 py-1 ring-1 ring-ui-border">
                      Student ID {profile.studentId}
                    </span>
                  )}
                  <span className="rounded-full bg-ui-surface px-3 py-1 ring-1 ring-ui-border">
                    {dashboard.recentResults.length} completed {dashboard.recentResults.length === 1 ? "week" : "weeks"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-ui-border/70 bg-ui-surface/80 px-4 py-3 text-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-text-muted">
              Current status
            </div>
            <div className="mt-1 flex items-center gap-2 font-semibold text-text-primary">
              <span className={`h-2.5 w-2.5 rounded-full ${dashboard.activeScenario ? "bg-amber-500" : "bg-emerald-500"}`} />
              {statusLabel}
            </div>
          </div>
        </div>
      </section>

      {latestResult && latestEntry && (
        <section className="card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-teal">
                Latest weekly results
              </div>
              <h2 className="mt-1 text-xl font-bold text-text-primary">
                {latestResult.week > 0 ? `Week ${latestResult.week}: ` : ""}
                {latestResult.title}
              </h2>
              {latestResult.completedAt && (
                <p className="mt-1 text-xs text-text-muted">
                  Results posted {new Date(latestResult.completedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <span className="badge-success self-start">Results released</span>
          </div>

          <MetricsKpiRow
            entry={latestEntry}
            definitions={metricDefinitions}
          />

          {(latestResult.outcomeNotes || latestResult.summary) && (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {latestResult.outcomeNotes && (
                <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <i className="pi pi-cloud text-brand-blue" aria-hidden />
                    What happened this week
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {latestResult.outcomeNotes}
                  </p>
                </div>
              )}
              {latestResult.summary && (
                <div className="rounded-xl border border-ui-border bg-ui-muted/40 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <i className="pi pi-sparkles text-brand-teal" aria-hidden />
                    Your performance summary
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {latestResult.summary}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {statistics && (
        <section className="card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-orange">
                Classroom statistics
              </div>
              <h2 className="mt-1 text-xl font-bold text-text-primary">
                How you compared this week
              </h2>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-ui-muted/60 px-4 py-3">
              <i className="pi pi-chart-bar text-xl text-brand-orange" aria-hidden />
              <div>
                <div className="text-xs text-text-muted">Class standing</div>
                <div className="font-bold text-text-primary">
                  {statistics.rank ? `#${statistics.rank}` : "—"} of {statistics.participantCount}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {comparisonDefinitions.map((definition) => (
              <ComparisonCard
                key={definition.key}
                definition={definition}
                statistics={statistics}
              />
            ))}
          </div>

          {statistics.leaderboardMetric && (
            <p className="mt-3 text-xs text-text-muted">
              Rank is based on {statistics.leaderboardMetric.label.toLowerCase()} for the latest released challenge. Class averages include {statistics.participantCount} submitted {statistics.participantCount === 1 ? "result" : "results"}.
            </p>
          )}
        </section>
      )}
    </div>
  );
};

export default StudentDashboardInsights;
