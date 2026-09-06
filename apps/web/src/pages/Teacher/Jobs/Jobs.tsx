import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import jobService from "../../../services/job";
import challengeService from "../../../services/challenge";
import type {
  SimulationJob,
  PopulatedUser,
  EvaluationReplacement,
} from "../../../types/job";
import type { Challenge } from "../../../types/challenge";
import LoadingOverlay from "../../../components/LoadingOverlay";

type JobStatusFilter =
  | "all"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "draft"
  | "published";

const statusOrder: Record<string, number> = {
  failed: 0,
  running: 1,
  pending: 2,
  completed: 3,
};

const statusBadgeClass: Record<string, string> = {
  pending: "badge-warning",
  running: "badge-info",
  completed: "badge-success",
  failed: "badge-danger",
};

const Jobs: React.FC = () => {
  const { challengeId: scenarioIdFromParams } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeClassroom } = useAuth();

  const [jobs, setJobs] = useState<SimulationJob[]>([]);
  const [challenges, setScenarios] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("all");
  const [scenarioFilter, setScenarioFilter] = useState<string>(
    scenarioIdFromParams ?? searchParams.get("challengeId") ?? "",
  );
  const [search, setSearch] = useState("");
  const [selectedDraft, setSelectedDraft] =
    useState<EvaluationReplacement | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const shouldPoll = useMemo(
    () =>
      jobs.some(
        (job) => job.status === "pending" || job.status === "running",
      ) && Boolean(scenarioFilter),
    [jobs, scenarioFilter],
  );

  const fetchScenarios = useCallback(async () => {
    const classroomId = activeClassroom?._id;
    if (!classroomId) return;

    try {
      const response = await challengeService.getAll(classroomId, "admin");
      const list = (response?.data ?? response ?? []) as Challenge[];
      setScenarios(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch challenges:", err);
    }
  }, [activeClassroom?._id]);

  useEffect(() => {
    if (activeClassroom?._id) {
      void fetchScenarios();
    }
  }, [activeClassroom?._id, fetchScenarios]);

  useEffect(() => {
    if (!scenarioFilter) {
      setJobs([]);
      return;
    }
    void fetchJobs(scenarioFilter);
  }, [scenarioFilter]);

  useEffect(() => {
    if (!scenarioFilter || !shouldPoll) return;
    const id = window.setTimeout(() => void fetchJobs(scenarioFilter), 5000);
    return () => window.clearTimeout(id);
  }, [scenarioFilter, shouldPoll]);

  const fetchJobs = async (currentScenarioId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await jobService.getJobsForScenario(currentScenarioId);
      const payload =
        typeof response === "object" && response !== null
          ? ((response as { data?: unknown }).data ?? response)
          : response;

      const list =
        Array.isArray(payload) &&
        payload.every((item) => typeof item === "object")
          ? (payload as SimulationJob[])
          : Array.isArray((payload as { data?: unknown })?.data)
            ? ((payload as { data: SimulationJob[] }).data ?? [])
            : [];

      setJobs(list);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
      setError("Failed to load jobs for this challenge.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs
      .filter((job) => {
        if (statusFilter !== "all" && getDisplayStatus(job) !== statusFilter)
          return false;
        if (!term) return true;
        const user = job.userId as PopulatedUser | string;
        const name =
          typeof user === "object"
            ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.toLowerCase()
            : "";
        return name.includes(term);
      })
      .sort((a, b) => {
        const aRank = statusOrder[a.status] ?? 99;
        const bRank = statusOrder[b.status] ?? 99;
        if (aRank !== bRank) return aRank - bRank;
        return (
          (b.startedAt ? new Date(b.startedAt).getTime() : 0) -
          (a.startedAt ? new Date(a.startedAt).getTime() : 0)
        );
      });
  }, [jobs, search, statusFilter]);

  const handleRetry = async (jobId: string) => {
    try {
      await jobService.retry(jobId);
      setJobs((prev) =>
        prev.map((job) =>
          job._id === jobId || job.id === jobId
            ? {
                ...job,
                status: "pending",
                error: null,
                startedAt: null,
                completedAt: null,
              }
            : job,
        ),
      );
    } catch (err) {
      console.error("Failed to retry job:", err);
      setError("Failed to retry the job. Please try again.");
    }
  };

  const refreshAfter = async (key: string, action: () => Promise<unknown>) => {
    setActionPending(key);
    setError(null);
    try {
      await action();
      if (scenarioFilter) await fetchJobs(scenarioFilter);
    } catch (err) {
      console.error("Processing action failed:", err);
      setError(
        "The processing action failed. Review the job error and try again.",
      );
    } finally {
      setActionPending(null);
    }
  };

  const handleScenarioFilterChange = (selectedScenarioId: string) => {
    setScenarioFilter(selectedScenarioId);
    if (selectedScenarioId) {
      setSearchParams({ challengeId: selectedScenarioId });
    } else {
      setSearchParams({});
    }
  };

  const getScenarioId = (challenge: Challenge) => {
    return challenge._id || (challenge as Challenge & { id?: string }).id || "";
  };

  const getUserName = (job: SimulationJob): string => {
    const user = job.userId as PopulatedUser | string;
    if (typeof user === "object") {
      const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
      return name || user._id || "Unknown user";
    }
    return user || "Unknown user";
  };

  const getJobId = (job: SimulationJob): string => {
    return job._id || job.id || "";
  };

  const getReplacement = (job: SimulationJob): EvaluationReplacement | null => {
    return job.replacementId && typeof job.replacementId === "object"
      ? job.replacementId
      : null;
  };

  function getDisplayStatus(job: SimulationJob): string {
    const replacement = getReplacement(job);
    if (replacement?.state === "queued") return "pending";
    if (replacement?.state === "processing") return "processing";
    if (replacement?.state === "draft") return "draft";
    if (replacement?.state === "published") return "published";
    if (replacement?.state === "failed") return "failed";
    return job.status === "running" ? "processing" : job.status;
  }

  const statusBodyTemplate = (rowData: SimulationJob) => {
    const displayStatus = getDisplayStatus(rowData);
    const badgeClass =
      statusBadgeClass[displayStatus] ??
      (displayStatus === "draft" ? "badge-warning" : "badge-success");
    return (
      <div className="flex items-center gap-2">
        <span className={`badge ${badgeClass}`}>{displayStatus}</span>
        {rowData.dryRun && <span className="badge badge-muted">Dry run</span>}
      </div>
    );
  };

  const studentBodyTemplate = (rowData: SimulationJob) => {
    return <span>{getUserName(rowData)}</span>;
  };

  const attemptsBodyTemplate = (rowData: SimulationJob) => {
    return <span>{rowData.attempts ?? 0}</span>;
  };

  const startedAtBodyTemplate = (rowData: SimulationJob) => {
    if (!rowData.startedAt) return <span className="text-text-muted">—</span>;
    return <span>{new Date(rowData.startedAt).toLocaleString()}</span>;
  };

  const completedAtBodyTemplate = (rowData: SimulationJob) => {
    if (!rowData.completedAt) return <span className="text-text-muted">—</span>;
    return <span>{new Date(rowData.completedAt).toLocaleString()}</span>;
  };

  const errorBodyTemplate = (rowData: SimulationJob) => {
    if (!rowData.error) return <span className="text-text-muted">—</span>;
    return (
      <span className="text-red-400" title={rowData.error}>
        {rowData.error.length > 50
          ? `${rowData.error.slice(0, 50)}…`
          : rowData.error}
      </span>
    );
  };

  const actionsBodyTemplate = (rowData: SimulationJob) => {
    const id = getJobId(rowData);
    const replacement = getReplacement(rowData);
    const decisionId =
      typeof rowData.decisionId === "object"
        ? rowData.decisionId?._id
        : rowData.decisionId;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {id && (
          <Link to={`/jobs/${id}`} className="btn-teal whitespace-nowrap">
            View job
          </Link>
        )}
        {(rowData.status === "failed" ||
          (rowData.status === "running" &&
            rowData.startedAt &&
            Date.now() - new Date(rowData.startedAt).getTime() >
              15 * 60 * 1000)) &&
          id && (
            <button
              type="button"
              className="btn-outline whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                void handleRetry(id);
              }}
            >
              {rowData.status === "running" ? "Retry stuck" : "Retry"}
            </button>
          )}
        {rowData.status === "completed" &&
          decisionId &&
          scenarioFilter &&
          replacement?.state !== "draft" &&
          replacement?.state !== "processing" &&
          replacement?.state !== "queued" && (
            <button
              type="button"
              className="btn-outline whitespace-nowrap"
              disabled={actionPending === id}
              onClick={(e) => {
                e.stopPropagation();
                if (
                  window.confirm(
                    "Generate a silent replacement draft? The published student result will remain visible.",
                  )
                ) {
                  void refreshAfter(id, () =>
                    jobService.rerunStudent(scenarioFilter, decisionId),
                  );
                }
              }}
            >
              Rerun silently
            </button>
          )}
        {replacement?.state === "draft" && (
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setSelectedDraft(replacement)}
            >
              Compare
            </button>
            <button
              type="button"
              className="btn-teal"
              disabled={actionPending === replacement._id}
              onClick={() =>
                void refreshAfter(replacement._id, () =>
                  jobService.publishReplacement(replacement._id),
                )
              }
            >
              Publish
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={actionPending === replacement._id}
              onClick={() => {
                if (
                  window.confirm(
                    "Discard this draft and retain the current published result?",
                  )
                ) {
                  void refreshAfter(replacement._id, () =>
                    jobService.discardReplacement(replacement._id),
                  );
                }
              }}
            >
              Discard
            </button>
          </>
        )}
        {replacement?.state === "published" && !replacement.notifiedAt && (
          <button
            type="button"
            className="btn-outline"
            disabled={actionPending === replacement._id}
            onClick={() => {
              if (
                window.confirm(
                  "Email this student that their replacement result is available?",
                )
              ) {
                void refreshAfter(replacement._id, () =>
                  jobService.notifyReplacement(replacement._id),
                );
              }
            }}
          >
            Notify student
          </button>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="card text-center">
          <p className="text-red-400 mb-4">{error}</p>
          {scenarioFilter && (
            <button
              className="btn-teal inline-flex"
              onClick={() => void fetchJobs(scenarioFilter)}
            >
              Try again
            </button>
          )}
        </div>
      );
    }

    const selectedScenario = challenges.find(
      (s) => getScenarioId(s) === scenarioFilter,
    );

    return (
      <>
        <LoadingOverlay loading={isLoading} />
        <div className="card mb-4">
          <div className="flex flex-col gap-4">
            {scenarioFilter && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-teal"
                  disabled={actionPending === "process-pending"}
                  onClick={() =>
                    void refreshAfter("process-pending", () =>
                      jobService.processPending(100, scenarioFilter),
                    )
                  }
                >
                  Process pending work
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-text-muted">Challenge</label>
                <select
                  className="input"
                  value={scenarioFilter}
                  onChange={(e) => handleScenarioFilterChange(e.target.value)}
                >
                  <option value="">All challenges</option>
                  {challenges.map((challenge) => {
                    const id = getScenarioId(challenge);
                    return (
                      <option key={id} value={id}>
                        {challenge.title || "Untitled Challenge"}
                      </option>
                    );
                  })}
                </select>
                {selectedScenario?.description && (
                  <p className="text-xs text-text-muted mt-1">
                    {selectedScenario.description}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-text-muted">Status</label>
                <select
                  className="input"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as JobStatusFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-text-muted">Search</label>
                <input
                  className="input"
                  placeholder="Student name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        {!scenarioFilter ? (
          <div className="card text-center py-10">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-text-muted"
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
            <h2 className="heading-lg mb-2">Select a challenge</h2>
            <p className="text-text-muted">
              Choose a challenge from the filter above to view AI processing
              jobs.
            </p>
          </div>
        ) : !jobs.length ? (
          <div className="card text-center py-10">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6M7 8h10M5 5h14v14H5z"
              />
            </svg>
            <h2 className="heading-lg mb-2">No jobs found</h2>
            <p className="text-text-muted">
              There are no AI processing jobs for this challenge yet.
            </p>
          </div>
        ) : (
          <div className="card">
            <DataTable
              value={filteredJobs}
              emptyMessage="No jobs found"
              loading={isLoading}
              dataKey="_id"
              paginator
              rows={25}
              rowsPerPageOptions={[10, 25, 50, 100]}
              removableSort
            >
              <Column
                field="status"
                header="Status"
                body={statusBodyTemplate}
                sortable
                sortField="status"
                style={{ minWidth: "120px" }}
              />
              <Column
                header="Student"
                body={studentBodyTemplate}
                style={{ minWidth: "150px" }}
              />
              <Column
                field="attempts"
                header="Attempts"
                body={attemptsBodyTemplate}
                sortable
                sortField="attempts"
                style={{ minWidth: "100px" }}
              />
              <Column
                field="startedAt"
                header="Started"
                body={startedAtBodyTemplate}
                sortable
                sortField="startedAt"
                style={{ minWidth: "180px" }}
              />
              <Column
                field="completedAt"
                header="Completed"
                body={completedAtBodyTemplate}
                sortable
                sortField="completedAt"
                style={{ minWidth: "180px" }}
              />
              <Column
                field="error"
                header="Error"
                body={errorBodyTemplate}
                style={{ minWidth: "200px" }}
              />
              <Column
                header="Actions"
                body={actionsBodyTemplate}
                style={{ minWidth: "150px" }}
              />
            </DataTable>
          </div>
        )}
        {selectedDraft && (
          <div className="card mt-4">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="heading-md">
                  Published result vs replacement draft
                </h2>
                <p className="text-sm text-text-muted">
                  The student continues to see the published result until you
                  publish this draft.
                </p>
              </div>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setSelectedDraft(null)}
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(["originalResult", "result"] as const).map((key) => {
                const value = selectedDraft[key] as
                  Record<string, unknown> | null | undefined;
                const metrics = (value?.metrics ?? {}) as Record<
                  string,
                  unknown
                >;
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-border p-4"
                  >
                    <h3 className="font-semibold mb-2">
                      {key === "originalResult"
                        ? "Currently published"
                        : "Replacement draft"}
                    </h3>
                    <p className="text-sm mb-3">
                      {String(value?.summary ?? "No summary")}
                    </p>
                    <div className="space-y-1 text-sm">
                      {Object.entries(metrics).map(([metric, metricValue]) => (
                        <div
                          key={metric}
                          className="flex justify-between gap-4"
                        >
                          <span className="text-text-muted">{metric}</span>
                          <span>{String(metricValue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <h1 className="heading-xl mb-6">Jobs</h1>
          {renderContent()}
        </div>
      </div>
    </BasicLayout>
  );
};

export default Jobs;
