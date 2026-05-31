import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import challengeService from "../../../services/challenge";
import type { Challenge } from "../../../types/challenge";
import type { Decision } from "../../../types/decision";
import type { LedgerEntry } from "../../../types/ledger";
import {
  getDecisionGenerationMethodLabel,
  getDecisionGenerationMethodBadgeClass,
} from "@/constants";
import { Accordion, AccordionTab } from "primereact/accordion";
import LoadingOverlay from "../../../components/LoadingOverlay";
import MetricsKpiRow from "../../../components/Metrics/MetricsKpiRow";

const Challenges: React.FC = () => {
  const { activeClassroom, userRole } = useAuth();
  const navigate = useNavigate();
  const [challenges, setScenarios] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScenarios = useCallback(async () => {
    if (!activeClassroom?._id) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await challengeService.getAll(
        activeClassroom._id,
        userRole === "org:admin" ? "admin" : "student"
      );
      setScenarios(response.data || response || []);
    } catch (err) {
      console.error("Failed to fetch challenges:", err);
      setError("Failed to load challenges");
    } finally {
      setIsLoading(false);
    }
  }, [activeClassroom?._id, userRole]);

  useEffect(() => {
    if (activeClassroom?._id) {
      void fetchScenarios();
    }
  }, [activeClassroom?._id, fetchScenarios]);

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  const getScenarioId = (challenge: Challenge) => {
    return challenge._id || (challenge as Challenge & { id?: string }).id || "";
  };

  const handleScenarioClick = (challenge: Challenge) => {
    const id = getScenarioId(challenge);
    if (id) {
      navigate(`/challenges/${id}`);
    }
  };

  const renderLedgerSummary = (ledgerEntry: LedgerEntry) => {
    const metricDefinitions = activeClassroom?.metricDefinitions ?? [];
    return (
      <div className="ml-2 mt-3 pt-3 border-t border-ui-border">
        <h4 className="text-lg text-text-primary font-semibold mb-2">
          Results
        </h4>
        <MetricsKpiRow
          entry={ledgerEntry}
          definitions={metricDefinitions}
        />
        {ledgerEntry.summary && (
          <div className="mt-3">
            <div className="text-text-muted text-md mb-1">Summary</div>
            <div className="text-md text-text-muted line-clamp-2">
              {ledgerEntry.summary}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <h1 className="heading-xl mb-6">Student Challenges</h1>
            <div className="card text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={fetchScenarios} className="btn-teal">
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
          <h1 className="heading-xl mb-6">Student Challenges</h1>

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
              <p className="text-text-muted">
                There are no challenges available for this class yet. Check back
                later!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {challenges.map((challenge) => {
                const challengeId = getScenarioId(challenge);
                const hasSubmission = !!challenge.decision;
                const decision = challenge.decision as
                  | Decision
                  | undefined;
                const ledgerEntry = challenge.ledgerEntry as
                  | LedgerEntry
                  | undefined;

                return (
                  <Accordion
                    key={challengeId}
                    className="card hover:bg-ui-muted transition-colors"
                    activeIndex={0}
                  >
                    <AccordionTab
                      header={
                        <div
                          className="ml-4"
                          onClick={(e) => {
                            // Check if click is on the accordion toggle arrow
                            // PrimeReact uses the class "p-accordion-toggle-icon" for the arrow SVG
                            const target = e.target as HTMLElement;
                            const isArrowClick =
                              target.closest(".p-accordion-toggle-icon") !==
                              null;

                            // If not clicking the arrow, prevent toggle and navigate instead
                            if (!isArrowClick) {
                              e.stopPropagation();
                              handleScenarioClick(challenge);
                            }
                          }}
                        >
                          <div className="flex items-center mb-2 justify-between">
                            <h3 className="text-lg font-semibold">
                              {challenge.title ||
                                (challenge as Challenge & { name?: string }).name}
                            </h3>
                            <div className="inline-block">
                              <span
                                className="badge badge-info py-1 px-3 text-sm cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleScenarioClick(challenge);
                                }}
                              >
                                View
                              </span>
                            </div>
                          </div>
                          {challenge.description && (
                            <p className="text-text-muted text-sm mb-3">
                              {challenge.description}
                            </p>
                          )}

                          {!hasSubmission && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="badge badge-warning">
                                Not submitted
                              </span>
                            </div>
                          )}

                          {hasSubmission && decision && (
                            <div className="flex items-center gap-2 text-sm mb-2">
                              <span
                                className={`badge ${getDecisionGenerationMethodBadgeClass(decision.generation?.method)}`}
                              >
                                {getDecisionGenerationMethodLabel(
                                  decision.generation?.method
                                )}
                              </span>
                              {decision.submittedAt && (
                                <span className="text-text-muted">
                                  on {formatDate(decision.submittedAt)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      }
                    >
                      <div
                        className="flex-1 min-w-0 ml-4 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleScenarioClick(challenge);
                        }}
                      >
                        {ledgerEntry ? (
                          renderLedgerSummary(ledgerEntry)
                        ) : (
                          <div className="text-text-muted text-sm mt-2 border-t border-ui-border pt-2">
                            No results available
                          </div>
                        )}
                      </div>
                    </AccordionTab>
                  </Accordion>
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
