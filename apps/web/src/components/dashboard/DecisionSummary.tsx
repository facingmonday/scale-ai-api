import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import challengeService from "../../services/challenge";
import decisionService from "../../services/decision";
import { normalizeScenarioId, pickDecisionRows, unwrap } from "./utils";
import type { SubmissionWithVariables } from "../../types/decision";
import type { ScenarioWithVariables } from "../../types/challenge";

interface DecisionSummaryProps {
  challenge?: ScenarioWithVariables | null;
  challengeId?: string | null;
}

const DecisionSummary: React.FC<DecisionSummaryProps> = ({
  challenge,
  challengeId: propScenarioId,
}) => {
  const { activeClassroom } = useAuth();
  const [currentScenario, setCurrentScenario] =
    useState<ScenarioWithVariables | null>(challenge || null);
  const [decision, setSubmission] = useState<SubmissionWithVariables | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;
  const challengeId =
    propScenarioId ||
    (currentScenario ? normalizeScenarioId(currentScenario) : null);

  // Fetch challenge if only ID provided
  useEffect(() => {
    if (!classroomId || !propScenarioId || currentScenario) return;

    const fetchScenario = async () => {
      try {
        const scenarioRes = await challengeService.getById(
          propScenarioId,
          "student"
        );
        setCurrentScenario(unwrap(scenarioRes) as any);
      } catch (err) {
        console.error("Failed to fetch challenge:", err);
      }
    };

    void fetchScenario();
  }, [classroomId, propScenarioId, currentScenario]);

  useEffect(() => {
    if (!classroomId || !challengeId) {
      setSubmission(null);
      setIsLoading(false);
      return;
    }

    const fetchSubmission = async () => {
      setIsLoading(true);
      try {
        const submissionRes = await decisionService.getStudentSubmissions({
          classroomId: classroomId,
          challengeId,
        });
        const list = unwrap(submissionRes) as any[];
        const latest = Array.isArray(list) && list.length > 0 ? list[0] : null;
        setSubmission(latest);
      } catch (e) {
        console.warn("Failed to fetch decision:", e);
        setSubmission(null);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSubmission();
  }, [classroomId, challengeId]);

  if (isLoading || !decision) {
    return null;
  }

  const decisionDefs =
    activeClassroom?.variableDefinitions?.decision ?? [];
  const decisionRows = pickDecisionRows(
    (decision as any)?.variables,
    decisionDefs
  );

  if (decisionRows.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="heading-md">Your decisions (locked)</h2>
        <span className="badge badge-success">
          <span className="inline-flex items-center gap-1">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 11V7a4 4 0 10-8 0v4m16 0V7a4 4 0 10-8 0v4m-4 0h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V11z"
              />
            </svg>
            Locked
          </span>
        </span>
      </div>

      <div className="grid gap-2">
        {decisionRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3"
          >
            <div className="text-text-muted text-sm">{row.label}</div>
            <div className="font-medium text-sm">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DecisionSummary;
