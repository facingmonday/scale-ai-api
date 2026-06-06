import React, { useCallback, useEffect, useState } from "react";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import challengeService from "../../../services/challenge";
import outcomeService from "../../../services/outcome";
import { useGlobalContext } from "../../../context/GlobalContext";
import ScenarioSummaryRow from "../../../components/ChallengeSummaryRow";
import { useNavigate } from "react-router-dom";
import LoadingOverlay from "../../../components/LoadingOverlay";

type ScenarioListItem = {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  isPublished?: boolean;
  isClosed?: boolean;
  isFeedbackReleased?: boolean;
  createdDate?: string | Date;
  createdAt?: string | Date;
  publishAt?: string | Date | null;
  submissionDeadlineAt?: string | Date | null;
  closeSubmissionsAt?: string | Date | null;
  processAt?: string | Date | null;
  feedbackReleaseAt?: string | Date | null;
  automationMode?: "MANUAL" | "FULL";
  automationStatus?: string;
  automationError?: string | null;
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "Not scheduled";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString();
};

const Challenges: React.FC = () => {
  const { activeClassroom } = useAuth();
  const globalContext = useGlobalContext();
  const [challenges, setScenarios] = useState<ScenarioListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleProcessNow = async (challengeId: string) => {
    try {
      globalContext?.showToast?.("Initiating calculation...", "loading");
      await outcomeService.approveOutcome(challengeId);
      globalContext?.showToast?.("Outcome processing queued successfully", "success");
      void fetchScenarios();
    } catch (e: any) {
      console.error("Failed to process outcome:", e);
      globalContext?.showToast?.(e?.response?.data?.error || "Failed to process outcome", "error");
    }
  };

  const handleReleaseFeedback = async (challengeId: string) => {
    try {
      globalContext?.showToast?.("Releasing feedback...", "loading");
      await challengeService.releaseFeedback(challengeId);
      globalContext?.showToast?.("Feedback released and students notified", "success");
      void fetchScenarios();
    } catch (e: any) {
      console.error("Failed to release feedback:", e);
      globalContext?.showToast?.(e?.response?.data?.error || "Failed to release feedback", "error");
    }
  };

  const renderTimeline = (status?: string) => {
    const stages = [
      { key: "SCHEDULED", label: "Scheduled" },
      { key: "acceptingSubmissions", label: "Open" },
      { key: "submissionsClosed", label: "Closed" },
      { key: "processing", label: "Processing" },
      { key: "feedbackReleased", label: "Released" }
    ];

    let activeIndex = -1;
    const lowerStatus = (status || "").toLowerCase();
    
    if (status === "SCHEDULED") activeIndex = 0;
    else if (status === "acceptingSubmissions") activeIndex = 1;
    else if (status === "submissionsClosed") activeIndex = 2;
    else if (["queuedforprocessing", "processing"].includes(lowerStatus)) activeIndex = 3;
    else if (["processed", "feedbackreleased"].includes(lowerStatus)) activeIndex = 4;

    return (
      <div className="mt-3 flex items-center justify-between w-full max-w-lg bg-ui-surface-muted/30 p-2.5 rounded-lg border border-ui-border/50">
        {stages.map((stage, idx) => {
          const isCompleted = idx < activeIndex;
          const isActive = idx === activeIndex;

          return (
            <React.Fragment key={stage.key}>
              {idx > 0 && (
                <div
                  className={`flex-1 h-0.5 mx-1.5 ${
                    isCompleted ? "bg-green-500" : isActive ? "bg-brand-blue" : "bg-ui-border"
                  }`}
                />
              )}
              <div className="flex flex-col items-center">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isActive
                      ? "bg-brand-blue text-white ring-2 ring-brand-blue/30"
                      : "bg-ui-surface text-text-muted border border-ui-border"
                  }`}
                >
                  {isCompleted ? "✓" : idx + 1}
                </div>
                <span
                  className={`text-[9px] mt-1 whitespace-nowrap font-medium ${
                    isActive ? "text-brand-blue font-semibold" : "text-text-muted"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchScenarios = useCallback(async () => {
    const classroomId = activeClassroom?._id;
    if (!classroomId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await challengeService.getAll(classroomId, "admin");
      const list = (response?.data ?? response ?? []) as ScenarioListItem[];
      setScenarios(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch challenges:", err);
      setError("Failed to load challenges");
    } finally {
      setIsLoading(false);
    }
  }, [activeClassroom?._id]);

  useEffect(() => {
    if (activeClassroom?._id) {
      void fetchScenarios();
    }
  }, [activeClassroom?._id, fetchScenarios]);

  if (error) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <h1 className="heading-xl mb-6">Teacher Challenges</h1>
            <div className="card text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => void fetchScenarios()}
                className="btn-teal"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  return (
    <BasicLayout>
      <LoadingOverlay loading={isLoading} />
      <div className="page">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading-xl">Teacher Challenges</h1>
            <button
              className="btn-teal"
              onClick={() => navigate("/challenges/new")}
              disabled={!activeClassroom?._id}
            >
              + Create Challenge
            </button>
          </div>

          {challenges.length === 0 ? (
            <div className="card text-center py-12">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="heading-lg mb-2">No Challenges Yet</h2>
              <p className="text-text-muted mb-6">
                Get started by creating your first challenge for this class.
              </p>
              <button
                className="btn-teal"
                onClick={() => navigate("/challenges/new")}
                disabled={!activeClassroom?._id}
              >
                Create Your First Challenge
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="card">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="heading-md">Challenge Calendar</h2>
                    <p className="text-sm text-text-muted">
                      Scheduled starts, deadlines, and automation status.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {[...challenges]
                    .sort((a, b) => {
                      const aDate = new Date(
                        a.publishAt || a.createdDate || a.createdAt || 0
                      ).getTime();
                      const bDate = new Date(
                        b.publishAt || b.createdDate || b.createdAt || 0
                      ).getTime();
                      return aDate - bDate;
                    })
                    .map((challenge) => {
                      const id = challenge._id || challenge.id || "";
                      const title =
                        challenge.title || challenge.name || "Untitled challenge";
                      
                      const showProcessNow = challenge.isPublished && !challenge.isClosed && 
                        !["queuedForProcessing", "processing", "processed", "feedbackReleased"].includes(challenge.automationStatus || "");
                      const showReleaseFeedback = challenge.isClosed && !challenge.isFeedbackReleased && challenge.automationStatus !== "feedbackReleased";

                      return (
                        <div
                          key={`calendar-${id}`}
                          className="rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-left hover:border-brand-blue cursor-pointer"
                          onClick={() => id && navigate(`/challenges/${id}`)}
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-text-primary text-base">
                                {title}
                              </div>
                              <div className="text-sm text-text-muted mt-0.5">
                                Opens {formatDateTime(challenge.publishAt)} · Due{" "}
                                {formatDateTime(
                                  challenge.submissionDeadlineAt
                                )}
                              </div>
                              
                              {challenge.automationStatus === "BLOCKED" && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded-md border border-yellow-400/20 max-w-fit">
                                  <i className="pi pi-exclamation-triangle" />
                                  <span>Outcome Required: {challenge.automationError}</span>
                                </div>
                              )}

                              {challenge.automationStatus === "FAILED" && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 px-2.5 py-1 rounded-md border border-red-400/20 max-w-fit">
                                  <i className="pi-times-circle" />
                                  <span>Automation Failed: {challenge.automationError}</span>
                                </div>
                              )}

                              {renderTimeline(challenge.automationStatus)}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex flex-wrap gap-2">
                                <span className="badge badge-muted">
                                  {challenge.automationMode === "FULL"
                                    ? "Automated"
                                    : "Manual"}
                                </span>
                                <span className={`badge ${
                                  challenge.automationStatus === "feedbackReleased"
                                    ? "badge-success"
                                    : challenge.automationStatus === "FAILED"
                                    ? "badge-danger"
                                    : challenge.automationStatus === "BLOCKED"
                                    ? "badge-warning"
                                    : "badge-muted"
                                }`}>
                                  {challenge.automationStatus || "UNSCHEDULED"}
                                </span>
                              </div>
                              
                              <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                {showProcessNow && (
                                  <button
                                    type="button"
                                    className="btn-teal py-1 px-3 text-xs font-semibold"
                                    onClick={() => id && void handleProcessNow(id)}
                                  >
                                    Process Now
                                  </button>
                                )}
                                {showReleaseFeedback && (
                                  <button
                                    type="button"
                                    className="btn-teal py-1 px-3 text-xs font-semibold"
                                    onClick={() => id && void handleReleaseFeedback(id)}
                                  >
                                    Release Feedback
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn-outline py-1 px-3 text-xs font-semibold"
                                  onClick={() => id && navigate(`/challenges/${id}`)}
                                >
                                  Extend Deadline
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="grid gap-4">
                {challenges.map((challenge) => {
                const id = challenge._id || challenge.id || "";
                const name =
                  challenge.title || challenge.name || "Untitled challenge";
                const createdAt: string = (() => {
                  const raw = challenge.createdDate ?? challenge.createdAt ?? "";
                  if (raw instanceof Date) return raw.toISOString();
                  return typeof raw === "string" ? raw : "";
                })();
                const status = !challenge.isPublished
                  ? "Draft"
                  : challenge.isClosed
                  ? "Closed"
                  : "Open";

                return (
                  <ScenarioSummaryRow
                    key={id}
                    challenge={{ id, name, status, createdAt }}
                    to={id ? `/challenges/${id}` : undefined}
                  />
                );
                })}
              </div>
            </div>
          )}
        </div>
      </div>


    </BasicLayout>
  );
};

export default Challenges;
