import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tooltip } from "primereact/tooltip";
import { Accordion, AccordionTab } from "primereact/accordion";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import challengeService from "../../../services/challenge";
import decisionService from "../../../services/decision";
import outcomeService from "../../../services/outcome";
import Outcome from "@/components/Outcome";
import { FormProvider, useForm } from "react-hook-form";
import type { Challenge } from "@/types/challenge";
import type { Decision } from "@/types/decision";
import type { Outcome as ScenarioOutcomeModel } from "@/types/outcome";
import type { SimulationJob } from "@/types/job";
import { VariablesDisplay, LedgerVisualization } from "@/components";
import { useAuth } from "@/context/AuthContext";
import type { VariableDefinitionWithValue } from "@/types/decision";
import type { Profile } from "@/types/profile";
import LoadingOverlay from "../../../components/LoadingOverlay";
import {
  getDecisionGenerationMethodLabel,
  getDecisionGenerationMethodBadgeClass,
} from "@/constants";

const SubmissionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeClassroom } = useAuth();
  const [decision, setSubmission] = useState<Decision | null>(null);
  const [challenge, setScenario] = useState<Challenge | null>(null);
  const [outcome, setScenarioOutcome] =
    useState<ScenarioOutcomeModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<{
    variables: Record<string, unknown>;
  }>({
    defaultValues: { variables: {} },
    mode: "onChange",
  });

  const fetchSubmission = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await decisionService.getById(id, "admin");
      const submissionData = (response.data || response) as Decision;
      setSubmission(submissionData);

      // Fetch challenge if we have a challengeId
      if (submissionData.challengeId) {
        try {
          const scenarioResponse = await challengeService.getById(
            submissionData.challengeId,
            "admin"
          );
          const scenarioData = (scenarioResponse.data ||
            scenarioResponse) as Challenge;
          setScenario(scenarioData);

          // Fetch challenge outcome to determine completion status
          try {
            const outcomeResponse = await outcomeService
              .getOutcome(submissionData.challengeId)
              .then((res) => res.data);
            setScenarioOutcome(outcomeResponse ?? null);
          } catch {
            // Outcome might not exist yet, which is fine
            setScenarioOutcome(null);
          }
        } catch (scenarioErr) {
          console.error("Failed to fetch challenge:", scenarioErr);
          // Continue even if challenge fetch fails
        }
      }
    } catch (err) {
      console.error("Failed to fetch decision:", err);
      setError("Failed to load decision");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      void fetchSubmission();
    }
  }, [id, fetchSubmission]);

  // Transform decision variables into VariableDefinitionWithValue[] format
  const submissionVariablesDisplay = useMemo(() => {
    if (!decision?.variables || !activeClassroom) return [];

    const submissionDefs =
      activeClassroom?.variableDefinitions?.decision ?? [];
    const submissionVariables =
      (decision.variables as Record<string, unknown>) ?? {};

    return submissionDefs
      .filter((def) =>
        Object.prototype.hasOwnProperty.call(submissionVariables, def.key)
      )
      .map((def) => ({
        ...def,
        value:
          submissionVariables[def.key] ??
          def.defaultValue ??
          (def.dataType === "number" ? 0 : ""),
      })) as VariableDefinitionWithValue[];
  }, [decision?.variables, activeClassroom]);

  // Transform challenge variables into VariableDefinitionWithValue[] format
  const scenarioVariablesDisplay = useMemo(() => {
    if (!challenge?.variables || !activeClassroom) return [];

    const scenarioDefs = activeClassroom?.variableDefinitions?.challenge ?? [];
    const scenarioVariables =
      (challenge.variables as Record<string, unknown>) ?? {};

    return scenarioDefs
      .filter((def) =>
        Object.prototype.hasOwnProperty.call(scenarioVariables, def.key)
      )
      .map((def) => ({
        ...def,
        value:
          scenarioVariables[def.key] ??
          def.defaultValue ??
          (def.dataType === "number" ? 0 : ""),
      })) as VariableDefinitionWithValue[];
  }, [challenge?.variables, activeClassroom]);

  // Determine challenge completion status
  // Note: Since 'approved' property doesn't exist, we check if outcome exists
  // and challenge is closed/published as indicators of completion
  const isScenarioCompleted = useMemo(() => {
    return (
      challenge?.isPublished && challenge?.isClosed && outcome !== null
    );
  }, [challenge?.isPublished, challenge?.isClosed, outcome]);

  // Extract jobs array from decision (jobs may not be in the type definition)
  const jobs = useMemo(() => {
    if (!decision) return [];
    const submissionWithJobs = decision as Decision & {
      jobs?: SimulationJob[];
    };
    return submissionWithJobs.jobs ?? [];
  }, [decision]);

  // Use challenge title if available, otherwise fallback
  const displayTitle = useMemo(
    () =>
      challenge?.title ||
      (challenge as Challenge & { name?: string })?.name ||
      "Decision",
    [challenge]
  );

  // Extract user info (handle both string and populated object)
  const user = useMemo(
    () =>
      decision && typeof decision.userId === "object"
        ? decision.userId
        : null,
    [decision]
  );

  // Get student ID for navigation
  const studentId = useMemo(
    () =>
      decision && typeof decision.userId === "object"
        ? decision.userId._id
        : decision?.userId,
    [decision]
  );

  // Extract profile info
  const profile = useMemo(
    () => decision?.profile as Profile | undefined,
    [decision]
  );

  // Get job ID helper
  const getJobId = (job: SimulationJob): string => {
    return job._id || job.id || "";
  };

  // Status badge class mapping
  const statusBadgeClass: Record<string, string> = {
    pending: "badge-warning",
    running: "badge-info",
    completed: "badge-success",
    failed: "badge-danger",
  };

  // DataTable column templates
  const statusBodyTemplate = (rowData: SimulationJob) => {
    const badgeClass = statusBadgeClass[rowData.status] ?? "badge";
    return (
      <div className="flex items-center gap-2">
        <span className={`badge ${badgeClass}`}>{rowData.status}</span>
        {rowData.dryRun && <span className="badge badge-muted">Dry run</span>}
      </div>
    );
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

  const idBodyTemplate = (rowData: SimulationJob) => {
    const jobId = getJobId(rowData);
    return <span className="font-mono text-sm text-text-muted">{jobId}</span>;
  };

  const submissionVariablesDisplayTitle = useMemo(() => {
    if (decision?.generation?.method) {
      return `Decision Variables (${getDecisionGenerationMethodLabel(decision.generation.method)})`;
    }
    return "Decision Variables";
  }, [decision]);

  if (error) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={fetchSubmission} className="btn-teal">
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
      {!decision ? (
        <div className="page">
          <div className="container">
            <div className="card text-center py-12">
              <h2 className="heading-lg mb-2">Decision Not Found</h2>
              <p className="text-text-muted">
                The decision you're looking for doesn't exist.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="page">
          <div className="container">
            <div className="flex items-center justify-start gap-2 mb-6">
              <div className="flex items-center gap-3">
                <h1 className="heading-xl">{displayTitle}</h1>
                {isScenarioCompleted && (
                  <span className="badge badge-success">Completed</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {decision.submittedAt && (
                  <>
                    <Tooltip
                      target=".decision-badge"
                      position="bottom"
                      content={new Date(
                        decision.submittedAt
                      ).toLocaleString()}
                    />
                    <span
                      className={`decision-badge badge ${getDecisionGenerationMethodBadgeClass(decision.generation?.method)}`}
                    >
                      {getDecisionGenerationMethodLabel(
                        decision.generation?.method
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Student and Profile Cards */}
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {user && (
                <div className="card flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="heading-md">Student</h2>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => navigate(`/students/${studentId}`)}
                      aria-label="View student details"
                      title="View student details"
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-text-muted text-sm">Name</p>
                      <p className="text-text-primary">
                        {user.firstName} {user.lastName}
                      </p>
                    </div>
                    {user.maskedEmail && (
                      <div>
                        <p className="text-text-muted text-sm">Email</p>
                        <p className="text-text-primary">{user.maskedEmail}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {profile && (
                <div className="card flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="heading-md">Profile</h2>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => navigate(`/students/${studentId}`)}
                      aria-label="View student details"
                      title="View student details"
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      {profile.imageUrl ? (
                        <img
                          src={profile.imageUrl}
                          alt={`${profile.shopName} thumbnail`}
                          className="profile-thumbnail"
                          loading="lazy"
                        />
                      ) : null}
                      <div className="space-y-2">
                        <div>
                          <p className="text-text-muted text-sm">Shop Name</p>
                          <p className="text-text-primary">{profile.shopName}</p>
                        </div>
                        {profile.studentId && (
                          <div>
                            <p className="text-text-muted text-sm">
                              Student ID
                            </p>
                            <p className="text-text-primary">
                              {profile.studentId}
                            </p>
                          </div>
                        )}
                        {profile.profileType && (
                          <div>
                            <p className="text-text-muted text-sm">
                              Profile Type
                            </p>
                            <p className="text-text-primary">
                              {typeof profile.profileType === "object"
                                ? profile.profileType.label
                                : profile.profileType}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* {profile.storeLocation && (
                      <div>
                        <p className="text-text-muted text-sm">Location</p>
                        <p className="text-text-primary">
                          {profile.storeLocation}
                        </p>
                      </div>
                    )} */}
                    {/* {profile.storeDescription && (
                    <div>
                      <p className="text-text-muted text-sm">Description</p>
                      <p className="text-text-primary text-sm">
                        {profile.storeDescription}
                      </p>
                    </div>
                  )} */}
                    {/* Render dynamic profileType variables as badges */}
                    {/* {profile?.profileType?.variables &&
                      Object.entries(profile?.profileType?.variables ?? {}).map(
                        ([key, value]) => (
                          <span
                            key={key}
                            className="badge badge-muted mr-2 mb-2 inline-block"
                            title={String(value)}
                          >
                            <span className="font-medium">{key}: </span>
                            <span className="text-text-primary">
                              {String(value)}
                            </span>
                          </span>
                        )
                      )} */}
                  </div>
                </div>
              )}
            </div>

            {challenge && (
              <div className="card mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="heading-lg">Challenge</h2>
                  {isScenarioCompleted && (
                    <span className="badge badge-success">Completed</span>
                  )}
                </div>
                {challenge.description && (
                  <p className="text-text-muted mb-4">{challenge.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-text-muted">Status: </span>
                    <span className="text-text-primary font-medium">
                      {challenge.isPublished
                        ? challenge.isClosed
                          ? isScenarioCompleted
                            ? "Completed"
                            : "Closed"
                          : "Published"
                        : "Draft"}
                    </span>
                  </div>
                  {challenge.isPublished && (
                    <div>
                      <span className="text-text-muted">Published: </span>
                      <span className="text-text-primary">Yes</span>
                    </div>
                  )}
                  {challenge.isClosed && (
                    <div>
                      <span className="text-text-muted">
                        Decisions Closed:{" "}
                      </span>
                      <span className="text-text-primary">Yes</span>
                    </div>
                  )}
                  {outcome && (
                    <div>
                      <span className="text-text-muted">Outcome: </span>
                      <span className="text-text-primary">Set</span>
                    </div>
                  )}
                  {
                    outcome && decision.generation?.method && (
                      <div>
                        <span className="text-text-muted">Decision Method: </span>
                        <span className="text-text-primary">{getDecisionGenerationMethodLabel(decision.generation.method)}</span>
                      </div>
                    )
                  }
                </div>
              </div>
            )}

            {scenarioVariablesDisplay.length > 0 && (
              <div className="card mb-6">
                <VariablesDisplay
                  variables={scenarioVariablesDisplay}
                  title={"Challenge Variables"}
                  description="Context and conditions for this challenge."
                />
              </div>
            )}

            <FormProvider {...form}>
              {submissionVariablesDisplay.length > 0 && (
                <div className="card mb-6">
                  <VariablesDisplay
                    variables={submissionVariablesDisplay}
                    title={submissionVariablesDisplayTitle}
                    description="Student's submitted values for this challenge."
                  />
                </div>
              )}

              {decision.challengeId && (
                <div className="mb-6">
                  <Outcome
                    challengeId={decision.challengeId}
                    challenge={challenge ?? undefined}
                  />
                </div>
              )}
            </FormProvider>

            {decision.ledgerEntry && (
              <div className="mb-6">
                <LedgerVisualization ledger={decision.ledgerEntry} />
              </div>
            )}

            <div className="card">
              <p className="text-text-muted text-sm">Decision ID: {id}</p>
              {decision.challengeId && (
                <p className="text-text-muted text-sm">
                  Challenge ID: {decision.challengeId}
                </p>
              )}
              {decision.classroomId && (
                <p className="text-text-muted text-sm">
                  Classroom ID: {decision.classroomId}
                </p>
              )}
            </div>

            {/* Jobs Accordion */}
            {jobs.length > 0 && (
              <div className="card mt-6">
                <Accordion>
                  <AccordionTab header="Show Advanced">
                    <div className="mt-4">
                      <DataTable
                        value={jobs}
                        emptyMessage="No jobs found"
                        dataKey="_id"
                        onRowClick={(e) => {
                          const jobId = getJobId(e.data as SimulationJob);
                          if (jobId) {
                            navigate(`/jobs/${jobId}`);
                          }
                        }}
                        rowClassName={() => "cursor-pointer hover:bg-ui-muted"}
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                      >
                        <Column
                          field="_id"
                          header="Job ID"
                          body={idBodyTemplate}
                          style={{ minWidth: "200px" }}
                        />
                        <Column
                          field="status"
                          header="Status"
                          body={statusBodyTemplate}
                          sortable
                          sortField="status"
                          style={{ minWidth: "120px" }}
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
                      </DataTable>
                    </div>
                  </AccordionTab>
                </Accordion>
              </div>
            )}
          </div>
        </div>
      )}
    </BasicLayout>
  );
};

export default SubmissionPage;
