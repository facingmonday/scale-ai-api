import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useUser } from "@clerk/clerk-react";
import challengeService from "../../services/challenge";
import decisionService from "../../services/decision";
import ledgerService from "../../services/ledger";
import { normalizeScenarioId, unwrap } from "./utils";
import { ActionBanner } from "./ActionBanner";
import type { ScenarioWithVariables } from "../../types/challenge";
import type { SubmissionWithVariables } from "../../types/decision";
import type { LedgerEntry } from "../../types/ledger";

const StudentActionBanner: React.FC = () => {
  const { activeClassroom } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [currentScenario, setCurrentScenario] =
    useState<ScenarioWithVariables | null>(null);
  const [currentSubmission, setCurrentSubmission] =
    useState<SubmissionWithVariables | null>(null);
  const [latestLedgerEntry, setLatestLedgerEntry] =
    useState<LedgerEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;
  const challengeId = useMemo(
    () => normalizeScenarioId(currentScenario),
    [currentScenario]
  );

  useEffect(() => {
    if (!classroomId) {
      setCurrentScenario(null);
      setCurrentSubmission(null);
      setLatestLedgerEntry(null);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const scenarioRes = await challengeService.getCurrent(classroomId);
        const nextScenario = unwrap(scenarioRes) as any;
        setCurrentScenario(nextScenario);

        const nextScenarioId = normalizeScenarioId(nextScenario);
        if (nextScenarioId) {
          // Fetch decision
          try {
            const submissionRes = await decisionService.getStudentSubmissions(
              {
                classroomId: classroomId,
                challengeId: nextScenarioId,
              }
            );
            const list = unwrap(submissionRes) as any[];
            const latest =
              Array.isArray(list) && list.length > 0 ? list[0] : null;
            setCurrentSubmission(latest);
          } catch (e) {
            setCurrentSubmission(null);
          }

          // Fetch ledger entry
          if (user?.id) {
            try {
              const entryRes = await ledgerService.getEntryForScenarioAndUser(
                nextScenarioId,
                user.id
              );
              setLatestLedgerEntry(unwrap(entryRes) as any);
            } catch {
              setLatestLedgerEntry(null);
            }
          }
        } else {
          setCurrentSubmission(null);
          setLatestLedgerEntry(null);
        }
      } catch (err) {
        console.error("Failed to fetch action banner data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [classroomId, user?.id]);

  const actionBanner = useMemo(() => {
    if (isLoading || !currentScenario || !challengeId) return null;

    const submitted = !!currentSubmission;
    const scenarioClosed = Boolean((currentScenario as any)?.isClosed);
    const resultsAvailable =
      !!latestLedgerEntry ||
      String((currentScenario as any)?.status ?? "")
        .toLowerCase()
        .includes("result") ||
      String((currentScenario as any)?.status ?? "")
        .toLowerCase()
        .includes("approved");

    if (resultsAvailable) {
      return {
        title: "Results are ready to view",
        subtitle: "See what happened and how your shop performed.",
        ctaLabel: "View results",
        onClick: () => navigate(`/challenge/${challengeId}`),
        badgeClass: "badge-success" as const,
      };
    }

    if (!submitted && !scenarioClosed) {
      return {
        title: "You need to submit this week's decisions",
        subtitle: "One decision per week. Once submitted, it locks.",
        ctaLabel: "Submit now",
        onClick: () => navigate(`/challenge/${challengeId}`),
        badgeClass: "badge-warning" as const,
      };
    }

    if (!submitted && scenarioClosed) {
      return {
        title: "You missed this week's decision",
        subtitle:
          "Your instructor will share results when the week closes out.",
        ctaLabel: "View week",
        onClick: () => navigate(`/challenge/${challengeId}`),
        badgeClass: "badge-warning" as const,
      };
    }

    if (submitted && !scenarioClosed) {
      return {
        title: "Submitted — you're done for now",
        subtitle: "Waiting for instructor approval and results.",
        ctaLabel: "View week",
        onClick: () => navigate(`/challenge/${challengeId}`),
        badgeClass: "badge-success" as const,
      };
    }

    return null;
  }, [
    isLoading,
    currentScenario,
    navigate,
    challengeId,
    currentSubmission,
    latestLedgerEntry,
  ]);

  if (!actionBanner) return null;

  return (
    <ActionBanner
      title={actionBanner.title}
      subtitle={actionBanner.subtitle}
      ctaLabel={actionBanner.ctaLabel}
      onClick={actionBanner.onClick}
      badgeClass={actionBanner.badgeClass}
    />
  );
};

export default StudentActionBanner;
