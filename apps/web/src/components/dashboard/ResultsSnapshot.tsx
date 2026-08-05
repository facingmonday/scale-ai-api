import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useUser } from "@clerk/clerk-react";
import challengeService from "../../services/challenge";
import ledgerService from "../../services/ledger";
import { normalizeScenarioId, unwrap } from "./utils";
import type { LedgerEntry } from "../../types/ledger";
import type { ScenarioWithVariables } from "../../types/challenge";
import MetricsKpiRow from "../Metrics/MetricsKpiRow";

interface ResultsSnapshotProps {
  challenge?: ScenarioWithVariables | null;
  challengeId?: string | null;
}

const ResultsSnapshot: React.FC<ResultsSnapshotProps> = ({
  challenge,
  challengeId: propScenarioId,
}) => {
  const { activeClassroom } = useAuth();
  const { user } = useUser();
  const [currentScenario, setCurrentScenario] =
    useState<ScenarioWithVariables | null>(challenge || null);
  const [ledgerEntry, setLedgerEntry] = useState<LedgerEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;
  const challengeId =
    propScenarioId ||
    (currentScenario ? normalizeScenarioId(currentScenario) : null);

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
    if (!classroomId || !challengeId || !user?.id) {
      setLedgerEntry(null);
      setIsLoading(false);
      return;
    }

    const fetchLedger = async () => {
      setIsLoading(true);
      try {
        const entryRes = await ledgerService.getEntryForScenarioAndUser(
          challengeId,
          user.id
        );
        setLedgerEntry(unwrap(entryRes) as any);
      } catch {
        setLedgerEntry(null);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchLedger();
  }, [classroomId, challengeId, user?.id]);

  const resultsAvailable =
    !!ledgerEntry ||
    String((currentScenario as any)?.status ?? "")
      .toLowerCase()
      .includes("result") ||
    String((currentScenario as any)?.status ?? "")
      .toLowerCase()
      .includes("approved");

  if (isLoading || !resultsAvailable || !ledgerEntry) {
    return null;
  }

  const metricDefinitions = activeClassroom?.metricDefinitions ?? [];

  return (
    <div className="card">
      <h2 className="heading-md mb-3">Latest results</h2>

      {metricDefinitions.length > 0 ? (
        <MetricsKpiRow
          definitions={metricDefinitions}
          entry={ledgerEntry}
        />
      ) : (
        <div className="text-text-muted text-sm">
          No metrics configured for this classroom.
        </div>
      )}

      {String((ledgerEntry as any)?.summary ?? "").trim() && (
        <div className="mt-4">
          <div className="text-text-muted text-sm mb-1">Summary</div>
          <div className="text-sm">{String((ledgerEntry as any)?.summary)}</div>
        </div>
      )}
    </div>
  );
};

export default ResultsSnapshot;
