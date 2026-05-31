import React, { useCallback, useEffect, useState } from "react";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import challengeService from "../../../services/challenge";
import ScenarioCreateForm from "../../../components/ChallengeCreateForm";
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
  createdDate?: string | Date;
  createdAt?: string | Date;
  publishAt?: string | Date | null;
  submissionDeadlineAt?: string | Date | null;
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
  const [challenges, setScenarios] = useState<ScenarioListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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
              onClick={() => setIsCreateDialogOpen(true)}
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
                onClick={() => setIsCreateDialogOpen(true)}
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
                      return (
                        <button
                          key={`calendar-${id}`}
                          type="button"
                          className="rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-left hover:border-brand-blue"
                          onClick={() => id && navigate(`/challenges/${id}`)}
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold text-text-primary">
                                {title}
                              </div>
                              <div className="text-sm text-text-muted">
                                Opens {formatDateTime(challenge.publishAt)} · Due{" "}
                                {formatDateTime(
                                  challenge.submissionDeadlineAt
                                )}
                              </div>
                              {challenge.automationError && (
                                <div className="mt-1 text-sm text-red-300">
                                  {challenge.automationError}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="badge badge-muted">
                                {challenge.automationMode === "FULL"
                                  ? "Automated"
                                  : "Manual"}
                              </span>
                              <span className="badge badge-success">
                                {challenge.automationStatus || "UNSCHEDULED"}
                              </span>
                            </div>
                          </div>
                        </button>
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

      {activeClassroom?._id && (
        <ScenarioCreateForm
          visible={isCreateDialogOpen}
          onHide={() => setIsCreateDialogOpen(false)}
          classroomId={activeClassroom._id}
          onSuccess={(challengeId) => {
            navigate(`/challenges/${challengeId}`);
          }}
        />
      )}
    </BasicLayout>
  );
};

export default Challenges;
