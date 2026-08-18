import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "@/context/GlobalContext";
import challengeService from "@/services/challenge";
import decisionService from "@/services/decision";
import outcomeService from "@/services/outcome";
import jobService from "@/services/job";
import CloseScenarioForm from "@/components/CloseChallengeForm";
import GlobalOutcomeModal from "@/components/dashboard/GlobalOutcomeModal";
import type { Challenge, ScenarioWithVariables } from "@/types/challenge";
import type { Outcome } from "@/types/outcome";
import type { SimulationJob } from "@/types/job";
import type { SubmissionWithVariables } from "@/types/decision";
import type { ClassDashboard } from "@/types/dashboard";
import { getErrorMessage } from "@/utils";
import {
  getChallengeLifecycleStatus,
} from "@/utils/challengeStatus";

interface TeacherCurrentScenarioCardProps {
  classroomId: string | null;
  dashboard: ClassDashboard | null;
  isLoadingDashboard?: boolean;
  challenges: Challenge[];
  onRefreshDashboard: () => Promise<void>;
  onRefreshScenarios: (silent?: boolean) => Promise<void>;
}

const TeacherCurrentScenarioCard: React.FC<TeacherCurrentScenarioCardProps> = ({
  classroomId,
  dashboard,
  isLoadingDashboard = false,
  challenges,
  onRefreshDashboard,
  onRefreshScenarios,
}) => {
  const navigate = useNavigate();
  const global = useGlobalContext();
  const [isCloseScenarioOpen, setIsCloseScenarioOpen] = useState(false);
  const [isOutcomeOpen, setIsOutcomeOpen] = useState(false);

  const [scenarioSubmissions, setScenarioSubmissions] = useState<
    SubmissionWithVariables[]
  >([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [scenarioJobs, setScenarioJobs] = useState<SimulationJob[]>([]);
  const [outcome, setScenarioOutcome] =
    useState<Outcome | null>(null);
  const [isLoadingOutcome, setIsLoadingOutcome] = useState(false);

  const activeScenario = useMemo(() => {
    const s = dashboard?.activeScenario;
    if (!s) return null;
    return s as unknown as ScenarioWithVariables;
  }, [dashboard?.activeScenario]);

  const activeScenarioId = useMemo(() => {
    return activeScenario?._id || activeScenario?.id || null;
  }, [activeScenario]);

  const scenarioWeekNumber = useMemo(() => {
    if (!activeScenarioId || challenges.length === 0) return null;
    const sorted = [...challenges].sort((a, b) => {
      const aDate = new Date(
        (a.createdDate as unknown as string) || 0
      ).getTime();
      const bDate = new Date(
        (b.createdDate as unknown as string) || 0
      ).getTime();
      return aDate - bDate;
    });
    const idx = sorted.findIndex(
      (s) => ((s?._id as string) || s?.id || "") === activeScenarioId
    );
    return idx >= 0 ? idx + 1 : null;
  }, [activeScenarioId, challenges]);

  const fetchScenarioSubmissions = useCallback(async () => {
    if (!activeScenarioId) {
      setScenarioSubmissions([]);
      return;
    }
    setIsLoadingSubmissions(true);
    try {
      const response = await decisionService.search({
        classroomId: classroomId as string,
        filters: [
          { field: "challengeId", operator: "eq", value: activeScenarioId },
        ],
      });
      setScenarioSubmissions(response.data);
    } catch (err) {
      console.error("Failed to fetch challenge decisions:", err);
      setScenarioSubmissions([]);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [classroomId, activeScenarioId]);

  const fetchScenarioJobs = useCallback(async () => {
    if (!activeScenarioId) {
      setScenarioJobs([]);
      return;
    }
    try {
      const response = await jobService.getJobsForScenario(activeScenarioId);
      const list = (response?.data ?? response ?? []) as SimulationJob[];
      setScenarioJobs(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch challenge jobs:", err);
      setScenarioJobs([]);
    }
  }, [activeScenarioId]);

  const fetchScenarioOutcome = useCallback(async () => {
    if (!activeScenarioId) {
      setScenarioOutcome(null);
      return;
    }
    setIsLoadingOutcome(true);
    try {
      const response = await outcomeService.getOutcome(
        activeScenarioId
      );
      const outcome = (response?.data ??
        response.data ??
        null) as Outcome | null;
      setScenarioOutcome(outcome);
    } catch {
      setScenarioOutcome(null);
    } finally {
      setIsLoadingOutcome(false);
    }
  }, [activeScenarioId]);

  useEffect(() => {
    void fetchScenarioSubmissions();
    void fetchScenarioJobs();
    void fetchScenarioOutcome();
  }, [fetchScenarioJobs, fetchScenarioOutcome, fetchScenarioSubmissions]);

  const studentCount = useMemo(() => {
    return typeof dashboard?.students === "number" ? dashboard.students : 0;
  }, [dashboard?.students]);

  const submissionProgress = useMemo(() => {
    const total = studentCount || 0;
    const completed =
      typeof dashboard?.submissionsCompleted === "number"
        ? dashboard.submissionsCompleted
        : scenarioSubmissions.length;
    const safeCompleted = Math.min(Math.max(completed, 0), total);
    const pct = total > 0 ? Math.round((safeCompleted / total) * 100) : 0;
    return { total, completed: safeCompleted, pct };
  }, [
    dashboard?.submissionsCompleted,
    scenarioSubmissions.length,
    studentCount,
  ]);

  const jobCounts = useMemo(() => {
    const total = scenarioJobs.length;
    const completed = scenarioJobs.filter(
      (j) => j.status === "completed"
    ).length;
    const failed = scenarioJobs.filter((j) => j.status === "failed").length;
    const running = scenarioJobs.filter((j) => j.status === "running").length;
    const pending = scenarioJobs.filter((j) => j.status === "pending").length;
    const inProgress = running + pending;
    return { total, completed, failed, running, pending, inProgress };
  }, [scenarioJobs]);

  const scenarioStatus = useMemo(() => {
    if (!activeScenario)
      return { label: "No challenge", kind: "muted" as const };
    const lifecycleStatus = getChallengeLifecycleStatus(activeScenario);
    if (lifecycleStatus === "Draft") {
      return { label: "Draft", kind: "muted" as const };
    }
    if (lifecycleStatus === "Open") {
      return { label: "Open", kind: "success" as const };
    }
    if (lifecycleStatus === "Locked") {
      return { label: "Locked", kind: "muted" as const };
    }
    if (!outcome)
      return { label: "Awaiting outcome", kind: "warning" as const };
    if (jobCounts.inProgress > 0)
      return { label: "Calculating Results", kind: "warning" as const };
    if (jobCounts.failed > 0)
      return { label: "Some failed", kind: "warning" as const };
    // If outcome exists and all jobs completed successfully, consider it completed
    if (outcome && jobCounts.completed > 0 && jobCounts.failed === 0)
      return { label: "Completed", kind: "success" as const };
    return { label: "Ready to approve", kind: "warning" as const };
  }, [
    activeScenario,
    jobCounts.completed,
    jobCounts.failed,
    jobCounts.inProgress,
    outcome,
  ]);

  const handlePublish = async () => {
    if (!activeScenarioId) return;
    try {
      global?.showToast("Publishing challenge…", "loading");
      await challengeService.publish(activeScenarioId);
      global?.showToast("Challenge published", "success");
      await onRefreshDashboard();
      await onRefreshScenarios();
    } catch (err) {
      console.error("Publish failed:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    }
  };

  const handleCloseSubmissions = async (reason: string) => {
    if (!activeScenarioId) return;
    try {
      global?.showToast("Closing decisions…", "loading");
      await challengeService.update(activeScenarioId, {
        isClosed: true,
        reason,
      });
      global?.showToast("Decisions closed", "success");
      setIsCloseScenarioOpen(false);
      await onRefreshDashboard();
      await fetchScenarioSubmissions();
      await fetchScenarioOutcome();
    } catch (err) {
      console.error("Close challenge failed:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    }
  };

  const handlePreview = async () => {
    if (!activeScenarioId) return;
    try {
      global?.showToast("Starting preview…", "loading");
      await challengeService.preview(activeScenarioId);
      global?.showToast("Preview started", "success");
      await fetchScenarioJobs();
    } catch (err) {
      console.error("Preview failed:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    }
  };

  const handleApproveOutcomes = async () => {
    if (!activeScenarioId) return;
    try {
      global?.showToast("Approving outcomes…", "loading");
      await outcomeService.approveOutcome(activeScenarioId);
      global?.showToast("Outcomes approved", "success");
      await fetchScenarioOutcome();
      await fetchScenarioJobs();
      await onRefreshDashboard();
    } catch (err) {
      console.error("Approve outcomes failed:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    }
  };

  useEffect(() => {
    const handler = () => navigate("/challenges/new");
    window.addEventListener("teacher:create-challenge", handler);
    return () => window.removeEventListener("teacher:create-challenge", handler);
  }, [navigate]);

  return (
    <div className="w-full">
      <div className="flex flex-col items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="heading-md">Current challenge</h2>
            {scenarioStatus.kind === "success" ? (
              <span className="badge-success">{scenarioStatus.label}</span>
            ) : scenarioStatus.kind === "warning" ? (
              <span className="badge-warning">{scenarioStatus.label}</span>
            ) : (
              <span className="badge bg-ui-muted text-text-secondary">
                {scenarioStatus.label}
              </span>
            )}
          </div>

          {activeScenario ? (
            <>
              <div className="mt-2">
                <div className="text-lg font-semibold truncate">
                  {activeScenario.title || "Untitled challenge"}
                </div>
                {scenarioWeekNumber ? (
                  <div className="text-sm text-text-muted">
                    Week {scenarioWeekNumber}
                  </div>
                ) : null}
              </div>

              {activeScenario.description ? (
                <p className="text-text-muted mt-2 max-h-24 overflow-y-auto">
                  {activeScenario.description}
                </p>
              ) : (
                <p className="text-text-muted mt-2">No description provided.</p>
              )}
            </>
          ) : (
            <p className="text-text-muted mt-2">
              No active challenge for this class yet.
            </p>
          )}
        </div>
      </div>

      {/* Decision progress */}
      {activeScenario &&
        activeScenario.isPublished &&
        !activeScenario.isClosed && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <div className="text-text-secondary">Decision progress</div>
              <div className="text-text-muted">
                {submissionProgress.completed} / {submissionProgress.total}{" "}
                submitted
              </div>
            </div>
            {isLoadingSubmissions && (
              <div className="text-sm text-text-muted mt-1">
                Refreshing decisions…
              </div>
            )}
            <div className="mt-2 h-2 w-full rounded-full bg-ui-muted overflow-hidden">
              <div
                className="h-full bg-brand-teal"
                style={{ width: `${submissionProgress.pct}%` }}
              />
            </div>
          </div>
        )}

      <div className="flex flex-col gap-2 mt-2">
        {!activeScenario ? (
          <button
            type="button"
            className="btn-teal"
            onClick={() => navigate("/challenges/new")}
          >
            + Create challenge
          </button>
        ) : (
          <>
            {!activeScenario.isPublished && (
              <button
                type="button"
                className="btn-teal"
                onClick={() => void handlePublish()}
                disabled={isLoadingDashboard}
              >
                Publish challenge
              </button>
            )}

            {activeScenario.isPublished && !activeScenario.isClosed && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  if (activeScenarioId) {
                    navigate(`/challenges/${activeScenarioId}`);
                  }
                }}
              >
                View Challenge
              </button>
            )}

            {activeScenario.isPublished && activeScenario.isClosed && (
              <>
                <button
                  type="button"
                  className="btn-teal"
                  onClick={() => setIsOutcomeOpen(true)}
                  disabled={isLoadingOutcome}
                >
                  {outcome
                    ? "Edit global outcome"
                    : "Enter global outcome"}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => void handlePreview()}
                  disabled={!outcome || jobCounts.inProgress > 0}
                >
                  Preview results
                </button>
                <button
                  type="button"
                  className="btn-orange"
                  onClick={() => void handleApproveOutcomes()}
                  disabled={
                    !outcome ||
                    (jobCounts.completed > 0 && jobCounts.failed === 0)
                  }
                >
                  Approve outcomes
                </button>
              </>
            )}
          </>
        )}
      </div>



      {/* Close Challenge Modal */}
      <CloseScenarioForm
        visible={isCloseScenarioOpen}
        onHide={() => setIsCloseScenarioOpen(false)}
        onSubmit={(reason) => void handleCloseSubmissions(reason)}
      />

      {/* Global Outcome Modal */}
      <GlobalOutcomeModal
        visible={isOutcomeOpen}
        activeScenarioId={activeScenarioId}
        onHide={() => setIsOutcomeOpen(false)}
        onSuccess={() => {
          void fetchScenarioOutcome();
          void onRefreshDashboard();
        }}
      />
    </div>
  );
};

export default TeacherCurrentScenarioCard;
