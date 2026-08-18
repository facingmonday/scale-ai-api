import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Clock3,
  FileSearch,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import challengeService from "../../services/challenge";
import { unwrap } from "./utils";
import firstChallengeImage from "../../assets/dashboard/students-first-challenge.webp";
import type { Challenge } from "@/types/challenge";
import type { StudentDashboardResult } from "@/types/dashboard";
import type { MetricDefinition } from "@/types/metric";
import {
  filterMetricsForDisplay,
  formatMetricValue,
  sortMetricDefinitions,
} from "@/utils/formatMetric";
import {
  getChallengeLifecycleBadgeClass,
  getChallengeLifecycleStatus,
} from "@/utils/challengeStatus";

interface PastScenariosProps {
  currentScenarioId?: string | null;
  variant?: "student" | "teacher";
  limit?: number;
  onRerun?: (challengeId: string) => Promise<void>;
  results?: StudentDashboardResult[];
  metricDefinitions?: MetricDefinition[];
  hasProfile?: boolean;
}

const PastScenarios: React.FC<PastScenariosProps> = ({
  currentScenarioId,
  variant = "student",
  results = [],
  metricDefinitions = [],
  hasProfile = false,
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

    if (!isLoading && pastChallenges.length === 0 && currentScenarioId) {
      return null;
    }

    if (isLoading) {
      return (
        <div className="card">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
              Your history
            </div>
            <h2 className="mt-1 text-xl font-bold text-text-primary">
              Previous challenges
            </h2>
          </div>
          <p className="text-sm text-text-muted">Loading challenges…</p>
        </div>
      );
    }

    if (pastChallenges.length === 0) {
      const steps = [
        {
          title: "Read the brief",
          description: "Meet the challenge and spot what matters.",
          icon: FileSearch,
          iconClass: "bg-brand-blue/10 text-brand-blue",
        },
        {
          title: "Make your call",
          description: "Choose how your business should respond.",
          icon: SlidersHorizontal,
          iconClass: "bg-brand-orange/10 text-brand-orange",
        },
        {
          title: "See what happened",
          description: "Explore the results and improve next time.",
          icon: ChartNoAxesCombined,
          iconClass: "bg-brand-teal/15 text-brand-blue",
        },
      ];

      return (
        <section
          className="overflow-hidden rounded-2xl border border-brand-blue/15 bg-ui-surface shadow-sm"
          aria-labelledby="first-challenge-title"
        >
          <div className="flex flex-col md:flex-row">
            <div className="flex flex-col justify-center px-6 py-7 md:w-1/2 md:px-8 md:py-9">
              <div className="flex w-fit items-center gap-2 rounded-full bg-brand-teal/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-brand-blue">
                <Sparkles className="size-3.5" aria-hidden />
                First challenge ahead
              </div>
              <h2
                id="first-challenge-title"
                className="mt-4 max-w-lg text-2xl font-bold leading-tight text-text-primary md:text-3xl"
              >
                Get ready to run your business
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary md:text-base">
                Your instructor will open the first challenge soon. You’ll work
                through a real business problem, make the call, and learn from
                the outcome.
              </p>

              <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="btn-teal inline-flex items-center gap-2"
                  onClick={() => navigate("/profile")}
                >
                  {hasProfile ? "Review your business" : "Build your business"}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
                <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                  <Clock3 className="size-4 text-brand-orange" aria-hidden />
                  Your instructor sets the start time
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-brand-blue/5 md:w-1/2">
              <img
                src={firstChallengeImage}
                alt="College students collaborating on a supply chain simulation in class"
                className="block min-h-64 w-full object-cover md:min-h-80"
              />
              <div
                className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-blue/45 to-transparent"
                aria-hidden
              />
              <div className="absolute bottom-4 left-4 rounded-full border border-white/40 bg-white/90 px-3 py-1.5 text-xs font-bold text-brand-blue shadow-sm backdrop-blur-sm">
                Learn by doing, together
              </div>
            </div>
          </div>

          <ol className="grid border-t border-ui-border bg-ui-muted/30 md:grid-cols-3 md:divide-x md:divide-ui-border">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <li
                  key={step.title}
                  className="flex items-center gap-3 border-b border-ui-border px-5 py-4 last:border-b-0 md:border-b-0 md:px-6"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${step.iconClass}`}
                  >
                    <StepIcon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                      Step {index + 1}
                    </div>
                    <div className="mt-0.5 text-sm font-bold text-text-primary">
                      {step.title}
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-text-muted">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      );
    }

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
            const statusLabel = getChallengeLifecycleStatus(s);
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
                  <span
                    className={`badge whitespace-nowrap ${getChallengeLifecycleBadgeClass(statusLabel)}`}
                  >
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
