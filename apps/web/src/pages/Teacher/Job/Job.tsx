import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import jobService from "../../../services/job";
import type {
  SimulationJob,
  PopulatedUser,
  PopulatedClassroom,
  PopulatedScenario,
  PopulatedSubmission,
} from "../../../types/job";
import LoadingOverlay from "../../../components/LoadingOverlay";

const statusBadgeClass: Record<string, string> = {
  pending: "badge-warning",
  running: "badge-info",
  completed: "badge-success",
  failed: "badge-danger",
};

const JobDetail: React.FC = () => {
  const { jobId } = useParams();
  const [job, setJob] = useState<SimulationJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badgeClass = statusBadgeClass[job?.status ?? ""] ?? "badge";

  const shouldPoll = useMemo(
    () => job?.status === "pending" || job?.status === "running",
    [job?.status]
  );

  useEffect(() => {
    if (jobId) {
      void fetchJob(jobId);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !shouldPoll) return;
    const id = window.setTimeout(() => void fetchJob(jobId), 4000);
    return () => window.clearTimeout(id);
  }, [jobId, shouldPoll]);

  const fetchJob = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await jobService.getById(id);
      const payload =
        typeof response === "object" && response !== null
          ? (response as { data?: unknown }).data ?? response
          : null;
      setJob((payload as SimulationJob) ?? null);
    } catch (err) {
      console.error("Failed to fetch job:", err);
      setError("Failed to load job.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!jobId) return;
    setIsRetrying(true);
    setError(null);
    try {
      await jobService.retry(jobId);
      await fetchJob(jobId);
    } catch (err) {
      console.error("Failed to retry job:", err);
      setError("Retry failed. Please try again.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopyError = async () => {
    if (!job?.error) return;
    try {
      await navigator.clipboard.writeText(job.error);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleCancel = async () => {
    if (!jobId || !job) return;
    if (
      !confirm(
        "Are you sure you want to cancel this job? This action cannot be undone."
      )
    ) {
      return;
    }
    setIsCancelling(true);
    setError(null);
    try {
      await jobService.cancel(jobId);
      await fetchJob(jobId);
    } catch (err) {
      console.error("Failed to cancel job:", err);
      setError("Failed to cancel job. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!jobId || !job) return;
    if (
      !confirm(
        "Are you sure you want to delete this job? This action cannot be undone."
      )
    ) {
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await jobService.deleteJob(jobId);
      // Redirect to jobs list after deletion
      window.location.href = "/jobs";
    } catch (err) {
      console.error("Failed to delete job:", err);
      setError("Failed to delete job. Please try again.");
      setIsDeleting(false);
    }
  };

  const handleForceRetry = async () => {
    if (!jobId) return;
    if (
      !confirm(
        "Are you sure you want to retry this job? This will reset its status and attempt to run again."
      )
    ) {
      return;
    }
    setIsRetrying(true);
    setError(null);
    try {
      await jobService.retry(jobId);
      await fetchJob(jobId);
    } catch (err) {
      console.error("Failed to retry job:", err);
      setError("Retry failed. Please try again.");
    } finally {
      setIsRetrying(false);
    }
  };

  const renderBody = () => {
    if (!jobId) {
      return (
        <div className="card">
          <p className="text-text-muted">No job id provided.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="card text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button className="btn-teal" onClick={() => void fetchJob(jobId)}>
            Try again
          </button>
        </div>
      );
    }

    if (!job) {
      return (
        <div className="card">
          <p className="text-text-muted">Job not found.</p>
        </div>
      );
    }

    const user = job.userId as PopulatedUser | string;
    const studentName =
      typeof user === "object"
        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user._id
        : user;

    const classroom = job.classroomId as PopulatedClassroom | string;
    const classroomId =
      typeof classroom === "object" ? classroom._id : classroom;
    const classroomName =
      typeof classroom === "object" ? classroom.name : undefined;

    const challenge = job.challengeId as PopulatedScenario | string;
    const challengeId = typeof challenge === "object" ? challenge._id : challenge;
    const scenarioTitle =
      typeof challenge === "object" ? challenge.title : undefined;

    const decision = job.decisionId as PopulatedSubmission | string | null;
    const decisionId =
      decision === null
        ? null
        : typeof decision === "object"
        ? decision._id
        : decision;
    const submissionDate =
      decision && typeof decision === "object" && decision.submittedAt
        ? new Date(decision.submittedAt).toLocaleString()
        : null;

    const scenarioDescription =
      typeof challenge === "object" ? challenge.description : undefined;
    const classroomDescription =
      typeof classroom === "object" ? classroom.description : undefined;

    return (
      <div className="card">
        <LoadingOverlay loading={isLoading} />
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`badge ${badgeClass}`}>{job.status}</span>
              <span className="text-xs text-text-muted">
                Attempts: {job.attempts ?? 0}
              </span>
              {job.dryRun && <span className="badge badge-muted">Dry run</span>}
            </div>
            <h2 className="heading-lg mb-1">Job {job._id}</h2>
            {studentName && (
              <p className="text-text-muted text-sm">Student: {studentName}</p>
            )}

            {/* Visual Cards for Related Entities */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {/* Classroom Card */}
              <div className="bg-ui-muted rounded-md border border-ui-border p-4 hover:border-brand-blue transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-brand-blue"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                      Classroom
                    </span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  {classroomName || "Unknown"}
                </h3>
                {classroomDescription && (
                  <p className="text-xs text-text-muted line-clamp-2 mb-2">
                    {classroomDescription}
                  </p>
                )}
                <p className="text-xs text-text-muted font-mono">
                  {classroomId}
                </p>
              </div>

              {/* Challenge Card */}
              {challengeId && (
                <Link
                  to={`/challenge/${challengeId}`}
                  className="bg-ui-muted rounded-md border border-ui-border p-4 hover:border-brand-teal transition-colors block"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-brand-teal"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                        Challenge
                      </span>
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">
                    {scenarioTitle || "Unknown"}
                  </h3>
                  {scenarioDescription && (
                    <p className="text-xs text-text-muted line-clamp-2 mb-2">
                      {scenarioDescription}
                    </p>
                  )}
                  <p className="text-xs text-text-muted font-mono">
                    {challengeId}
                  </p>
                </Link>
              )}

              {/* Decision Card */}
              {decisionId ? (
                <Link
                  to={`/decision/${decisionId}`}
                  className="bg-ui-muted rounded-md border border-ui-border p-4 hover:border-brand-orange transition-colors block"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-brand-orange"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                        Decision
                      </span>
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">
                    Submitted
                  </h3>
                  {submissionDate && (
                    <p className="text-xs text-text-muted mb-2">
                      {submissionDate}
                    </p>
                  )}
                  <p className="text-xs text-text-muted font-mono">
                    {decisionId}
                  </p>
                </Link>
              ) : (
                <div className="bg-ui-muted rounded-md border border-ui-border border-dashed p-4 flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="w-8 h-8 text-text-muted mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-xs text-text-muted">No decision</p>
                  </div>
                </div>
              )}
            </div>
            <div className="text-xs text-text-muted mt-3 space-y-1">
              {job.startedAt && (
                <p>Started: {new Date(job.startedAt).toLocaleString()}</p>
              )}
              {job.completedAt && (
                <p>Completed: {new Date(job.completedAt).toLocaleString()}</p>
              )}
              {job.updatedDate && (
                <p>Updated: {new Date(job.updatedDate).toLocaleString()}</p>
              )}
            </div>
            {job.error && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-text-muted">Error</p>
                  <button
                    type="button"
                    className="btn-outline btn-xs"
                    onClick={() => void handleCopyError()}
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-ui-muted rounded-md p-3 text-sm text-red-400 whitespace-pre-wrap break-words">
                  {job.error}
                </pre>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {challengeId && (
              <Link
                to={`/challenges/${challengeId}`}
                className="btn-outline whitespace-nowrap"
              >
                View challenge
              </Link>
            )}
            {decisionId && (
              <Link
                to={`/decisions/${decisionId}`}
                className="btn-outline whitespace-nowrap"
              >
                View decision
              </Link>
            )}
            <button
              type="button"
              className="btn-outline whitespace-nowrap"
              disabled={isLoading}
              onClick={() => void fetchJob(jobId!)}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
            {(job.status === "pending" || job.status === "running") && (
              <button
                type="button"
                className="btn-outline whitespace-nowrap"
                disabled={isCancelling}
                onClick={() => void handleCancel()}
              >
                {isCancelling ? "Cancelling..." : "Cancel job"}
              </button>
            )}
            {(job.status === "failed" ||
              job.status === "pending" ||
              job.status === "running") && (
              <button
                type="button"
                className="btn-teal whitespace-nowrap"
                disabled={isRetrying}
                onClick={() => void handleRetry()}
              >
                {isRetrying ? "Retrying..." : "Retry job"}
              </button>
            )}
            {(job.status === "completed" || job.status === "failed") && (
              <button
                type="button"
                className="btn-outline whitespace-nowrap"
                disabled={isRetrying}
                onClick={() => void handleForceRetry()}
              >
                {isRetrying ? "Retrying..." : "Force retry"}
              </button>
            )}
            {(job.status === "completed" || job.status === "failed") && (
              <button
                type="button"
                className="btn-outline whitespace-nowrap text-red-400 hover:text-red-300"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? "Deleting..." : "Delete job"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading-xl">Job detail</h1>
            <Link to="/jobs" className="btn-outline">
              Back to jobs
            </Link>
          </div>
          {renderBody()}
        </div>
      </div>
    </BasicLayout>
  );
};

export default JobDetail;
