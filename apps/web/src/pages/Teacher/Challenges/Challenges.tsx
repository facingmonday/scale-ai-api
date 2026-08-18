import React, { useCallback, useEffect, useState } from "react";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import challengeService from "../../../services/challenge";
import outcomeService from "../../../services/outcome";
import { useGlobalContext } from "../../../context/GlobalContext";
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

const formatAutomationStatus = (status?: string) => {
  const labels: Record<string, string> = {
    UNSCHEDULED: "Unscheduled",
    SCHEDULED: "Scheduled",
    PUBLISHED: "Published",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    BLOCKED: "Blocked",
    FAILED: "Failed",
    DRAFT: "Draft",
    acceptingSubmissions: "Open",
    submissionsClosed: "Closed",
    queuedForProcessing: "Queued",
    processed: "Processed",
    feedbackReleased: "Released",
  };
  if (!status) return "Unscheduled";
  return labels[status] ?? status;
};

const getServiceErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return fallback;
  }

  const response = (
    error as { response?: { data?: { error?: unknown } } }
  ).response;

  return typeof response?.data?.error === "string"
    ? response.data.error
    : fallback;
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
      globalContext?.showToast?.(
        "Outcome processing queued successfully",
        "success",
      );
      void fetchScenarios();
    } catch (e: unknown) {
      console.error("Failed to process outcome:", e);
      globalContext?.showToast?.(
        getServiceErrorMessage(e, "Failed to process outcome"),
        "error",
      );
    }
  };

  const handleReleaseFeedback = async (challengeId: string) => {
    try {
      globalContext?.showToast?.("Releasing feedback...", "loading");
      await challengeService.releaseFeedback(challengeId);
      globalContext?.showToast?.(
        "Feedback released and students notified",
        "success",
      );
      void fetchScenarios();
    } catch (e: unknown) {
      console.error("Failed to release feedback:", e);
      globalContext?.showToast?.(
        getServiceErrorMessage(e, "Failed to release feedback"),
        "error",
      );
    }
  };

  const renderTimeline = (status?: string) => {
    const stages = [
      { key: "SCHEDULED", label: "Scheduled" },
      { key: "acceptingSubmissions", label: "Open" },
      { key: "submissionsClosed", label: "Closed" },
      { key: "processing", label: "Processing" },
      { key: "feedbackReleased", label: "Released" },
    ];

    let activeIndex = -1;
    const lowerStatus = (status || "").toLowerCase();

    if (status === "SCHEDULED") activeIndex = 0;
    else if (status === "acceptingSubmissions") activeIndex = 1;
    else if (status === "submissionsClosed") activeIndex = 2;
    else if (["queuedforprocessing", "processing"].includes(lowerStatus))
      activeIndex = 3;
    else if (["processed", "feedbackreleased"].includes(lowerStatus))
      activeIndex = 4;

    return (
      <div
        className="mt-5 w-full rounded-xl border border-ui-border bg-ui-surface-hover/60 px-3 py-4 sm:px-5"
        aria-label="Challenge progress"
      >
        <div className="flex w-full items-start">
          {stages.map((stage, idx) => {
            const isCompleted = idx < activeIndex;
            const isActive = idx === activeIndex;

            return (
              <React.Fragment key={stage.key}>
                <div className="flex min-w-14 flex-col items-center text-center">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                      isCompleted
                        ? "bg-brand-teal text-text-primary shadow-sm"
                        : isActive
                          ? "bg-brand-blue text-white shadow-sm ring-4 ring-brand-blue/20"
                          : "border-2 border-ui-border bg-ui-surface text-text-muted"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`mt-2 text-[10px] font-medium sm:text-xs ${
                      isActive
                        ? "font-semibold text-brand-teal"
                        : isCompleted
                          ? "text-text-secondary"
                          : "text-text-muted"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
                {idx < stages.length - 1 && (
                  <div
                    className={`mx-1 mt-3 h-[2px] min-w-3 flex-1 rounded-full sm:mx-3 ${
                      idx < activeIndex
                        ? "bg-brand-teal"
                        : "bg-ui-border"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
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
        <div className="container w-full">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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
            <div className="flex w-full flex-col gap-4">
                  {[...challenges]
                    .sort((a, b) => {
                      const aDate = new Date(
                        a.publishAt || a.createdDate || a.createdAt || 0,
                      ).getTime();
                      const bDate = new Date(
                        b.publishAt || b.createdDate || b.createdAt || 0,
                      ).getTime();
                      return aDate - bDate;
                    })
                    .map((challenge) => {
                      const id = challenge._id || challenge.id || "";
                      const title =
                        challenge.title ||
                        challenge.name ||
                        "Untitled challenge";

                      const showProcessNow =
                        challenge.isPublished &&
                        !challenge.isClosed &&
                        ![
                          "queuedForProcessing",
                          "processing",
                          "processed",
                          "feedbackReleased",
                        ].includes(challenge.automationStatus || "");
                      const showReleaseFeedback =
                        challenge.isClosed &&
                        !challenge.isFeedbackReleased &&
                        challenge.automationStatus !== "feedbackReleased";

                      return (
                        <article
                          key={`calendar-${id}`}
                          className="w-full cursor-pointer overflow-hidden rounded-xl border border-ui-border bg-ui-surface text-left transition-[border-color,box-shadow] hover:border-brand-blue/60 hover:shadow-xs"
                          onClick={() => id && navigate(`/challenges/${id}`)}
                        >
                          <div className="p-4 sm:p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="text-base font-semibold text-text-primary sm:text-lg">
                                  {title}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-text-muted">
                                  <span className="flex items-center gap-1.5">
                                    <i
                                      className="pi pi-calendar text-xs"
                                      aria-hidden="true"
                                    />
                                    Opens {formatDateTime(challenge.publishAt)}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <i
                                      className="pi pi-clock text-xs"
                                      aria-hidden="true"
                                    />
                                    Due{" "}
                                    {formatDateTime(
                                      challenge.submissionDeadlineAt,
                                    )}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                                <span className="badge badge-muted">
                                  {challenge.automationMode === "FULL"
                                    ? "Automated"
                                    : "Manual"}
                                </span>
                                <span
                                  className={`badge ${
                                    challenge.automationStatus ===
                                    "feedbackReleased"
                                      ? "badge-success"
                                      : challenge.automationStatus === "FAILED"
                                        ? "badge-danger"
                                        : challenge.automationStatus ===
                                            "BLOCKED"
                                          ? "badge-warning"
                                          : "badge-muted"
                                  }`}
                                >
                                  {formatAutomationStatus(
                                    challenge.automationStatus,
                                  )}
                                </span>
                              </div>
                            </div>

                            {challenge.automationStatus === "BLOCKED" && (
                              <div className="mt-4 flex max-w-fit items-center gap-1.5 rounded-md border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1 text-xs text-yellow-500">
                                <i className="pi pi-exclamation-triangle" />
                                <span>
                                  Outcome Required: {challenge.automationError}
                                </span>
                              </div>
                            )}

                            {challenge.automationStatus === "FAILED" && (
                              <div className="mt-4 flex max-w-fit items-center gap-1.5 rounded-md border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-xs text-red-400">
                                <i className="pi pi-times-circle" />
                                <span>
                                  Automation Failed: {challenge.automationError}
                                </span>
                              </div>
                            )}

                            {renderTimeline(challenge.automationStatus)}
                          </div>

                          <div
                            className="flex flex-wrap items-center justify-end gap-2 border-t border-ui-border bg-ui-muted/25 px-4 py-3 sm:px-5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {showProcessNow && (
                              <button
                                type="button"
                                className="btn-teal px-3 py-1.5 text-xs font-semibold"
                                onClick={() =>
                                  id && void handleProcessNow(id)
                                }
                              >
                                Process Now
                              </button>
                            )}
                            {showReleaseFeedback && (
                              <button
                                type="button"
                                className="btn-teal px-3 py-1.5 text-xs font-semibold"
                                onClick={() =>
                                  id && void handleReleaseFeedback(id)
                                }
                              >
                                Release Feedback
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-outline px-3 py-1.5 text-xs font-semibold"
                              onClick={() =>
                                id && navigate(`/challenges/${id}`)
                              }
                            >
                              Extend Deadline
                            </button>
                          </div>
                        </article>
                      );
                    })}
            </div>
          )}
        </div>
      </div>
    </BasicLayout>
  );
};

export default Challenges;
