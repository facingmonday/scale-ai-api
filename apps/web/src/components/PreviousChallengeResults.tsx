import React, { useCallback, useEffect, useMemo, useState } from "react";
import challengeService from "@/services/challenge";
import type { Challenge } from "@/types/challenge";
import type { LedgerEntry } from "@/types/ledger";
import type { VariableDefinitionWithValue } from "@/types/decision";
import { useAuth } from "@/context/AuthContext";
import LastWeekResults from "./LastWeekResults";

interface PreviousScenarioResultsProps {
  challengeId: string | undefined;
}

const PreviousScenarioResults: React.FC<PreviousScenarioResultsProps> = ({
  challengeId,
}) => {
  const { activeClassroom } = useAuth();

  const submissionVariableDefinitions: VariableDefinitionWithValue[] =
    useMemo(
      () =>
        activeClassroom?.variableDefinitions?.decision?.map((def) => ({
          ...def,
          value:
            def.defaultValue ?? (def.dataType === "number" ? 0 : ""),
        })) ?? [],
      [activeClassroom?.variableDefinitions?.decision]
    );

  const classroomId = activeClassroom?._id;
  const [previousScenarioLedger, setPreviousScenarioLedger] =
    useState<LedgerEntry | null>(null);

  const fetchPreviousScenarioLedger = useCallback(async () => {
    if (!challengeId || !classroomId) return;

    try {
      const response = await challengeService.getAll(classroomId, "student");
      const allScenarios = (response?.data ?? response ?? []) as Challenge[];

      if (!Array.isArray(allScenarios) || allScenarios.length === 0) {
        setPreviousScenarioLedger(null);
        return;
      }

      const sortedScenarios = [...allScenarios].sort((a, b) => {
        const aDate = new Date(
          (a.createdDate as unknown as string) || 0
        ).getTime();
        const bDate = new Date(
          (b.createdDate as unknown as string) || 0
        ).getTime();
        return aDate - bDate;
      });

      const currentIndex = sortedScenarios.findIndex(
        (s) => (s._id || s.id || "") === challengeId
      );

      if (currentIndex <= 0) {
        setPreviousScenarioLedger(null);
        return;
      }

      const previousScenario = sortedScenarios[currentIndex - 1];

      if (previousScenario._id || previousScenario.id) {
        const prevScenarioId = previousScenario._id || previousScenario.id;
        const prevScenarioResp = await challengeService.getById(
          prevScenarioId,
          "student"
        );
        const prevScenarioData = (prevScenarioResp.data ||
          prevScenarioResp) as Challenge;

        if (prevScenarioData.ledgerEntry) {
          setPreviousScenarioLedger(prevScenarioData.ledgerEntry);
        } else {
          setPreviousScenarioLedger(null);
        }
      } else {
        setPreviousScenarioLedger(null);
      }
    } catch (err) {
      console.warn("Failed to fetch previous challenge ledger:", err);
      setPreviousScenarioLedger(null);
    }
  }, [challengeId, classroomId]);

  useEffect(() => {
    if (challengeId) {
      void fetchPreviousScenarioLedger();
    }
  }, [challengeId, fetchPreviousScenarioLedger]);

  if (!previousScenarioLedger) return null;

  return (
    <div className="mb-6">
      <LastWeekResults
        ledger={previousScenarioLedger}
        submissionVariableDefinitions={submissionVariableDefinitions}
      />
    </div>
  );
};

export default PreviousScenarioResults;
