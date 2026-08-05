import React, { useEffect, useState, useCallback } from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
import decisionService from "../services/decision";
import LedgerVisualization from "./LedgerVisualization";
import type { VariableDefinitionWithValue } from "../types/decision";
import type { LedgerEntry } from "../types/ledger";
import { useNavigate } from "react-router-dom";

interface SubmissionListProps {
  studentId?: string;
  classroomId?: string;
  challengeId?: string;
}

interface SubmissionWithPopulatedData {
  _id: string;
  classroomId: string;
  challengeId: string;
  userId: string;
  submittedAt: string;
  variables: VariableDefinitionWithValue[];
  ledgerEntry?: LedgerEntry;
  classroom?: {
    _id: string;
    name: string;
  };
  challenge?: {
    _id: string;
    title: string;
    isPublished: boolean;
    isClosed: boolean;
  };
}

const SubmissionList: React.FC<SubmissionListProps> = ({ studentId }) => {
  const [decisions, setSubmissions] = useState<SubmissionWithPopulatedData[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSubmissions = useCallback(async () => {
    if (!studentId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await decisionService.getAllPerStudent(studentId);
      setSubmissions(response.data || []);
    } catch (err) {
      console.error("Failed to fetch decisions:", err);
      setError("Failed to load decisions");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) {
      fetchSubmissions();
    }
  }, [studentId, fetchSubmissions]);

  if (isLoading) {
    return (
      <div className="card">
        <p className="text-text-muted">Loading decisions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={fetchSubmissions} className="btn-teal">
          Try Again
        </button>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="card text-center py-8">
        <svg
          className="w-12 h-12 mx-auto mb-4 text-text-muted"
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
        <h3 className="heading-md mb-2">No Decisions</h3>
        <p className="text-text-muted text-sm">
          This student hasn't submitted any work for this classroom yet.
        </p>
      </div>
    );
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  const handleSubmissionClick = (decisionId: string) => {
    navigate(`/decisions/${decisionId}`);
  };

  return (
    <div className="space-y-4">
      <h2 className="heading-lg mb-4">
        Decisions ({decisions?.length ?? 0})
      </h2>
      <div className="flex flex-col gap-4">
        {decisions?.length > 0 &&
          decisions?.map((decision) => {
            const scenarioTitle =
              decision.challenge?.title || "Unnamed Challenge";
            const summary = decision.ledgerEntry?.summary || "";

            return (
              <Accordion
                key={decision._id}
                className="card hover:bg-ui-muted transition-colors"
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
                          target.closest(".p-accordion-toggle-icon") !== null;

                        // If not clicking the arrow, prevent toggle and navigate instead
                        if (!isArrowClick) {
                          e.stopPropagation();
                          handleSubmissionClick(decision._id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold">
                          {scenarioTitle}
                        </h3>
                        {decision.submittedAt && (
                          <span className="text-text-muted text-sm">
                            {formatDate(decision.submittedAt)}
                          </span>
                        )}
                      </div>

                      {/** Ledger Entry summary */}
                      {summary && (
                        <p className="text-text-muted text-sm mb-3">
                          {summary}
                        </p>
                      )}

                      {/* {decision.variables &&
                        typeof decision.variables === "object" &&
                        !Array.isArray(decision.variables) &&
                        Object.keys(decision.variables).length > 0 && (
                          <div className="mb-2 pt-2 border-t border-ui-border">
                            <p className="text-text-muted text-xs mb-2 font-medium">
                              Decision Variables:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(decision.variables).map(
                                ([key, value], index) => {
                                  const displayValue =
                                    typeof value === "object"
                                      ? JSON.stringify(value)
                                      : String(value);
                                  return (
                                    <span
                                      key={index}
                                      className="text-xs bg-ui-muted px-2 py-1 rounded"
                                    >
                                      {key}: {displayValue}
                                    </span>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )} */}
                    </div>
                  }
                >
                  <div className="ml-4 mt-4">
                    {decision.ledgerEntry ? (
                      <LedgerVisualization ledger={decision.ledgerEntry} />
                    ) : (
                      <div className="text-text-muted text-sm">
                        No ledger data available for this decision yet.
                      </div>
                    )}
                  </div>
                </AccordionTab>
              </Accordion>
            );
          })}
      </div>
    </div>
  );
};

export default SubmissionList;
