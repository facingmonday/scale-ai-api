import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import ledgerService from "../../services/ledger";
import { normalizeScenarioId, unwrap } from "./utils";
import type { ScenarioWithVariables } from "../../types/challenge";
import type { LedgerEntry } from "../../types/ledger";

interface CurrentScenarioCardProps {
  challenge: ScenarioWithVariables | null;
  submissionStatus?: {
    submitted: boolean;
    submittedAt: string | null;
  } | null;
}

const CurrentScenarioCard: React.FC<CurrentScenarioCardProps> = ({
  challenge,
  submissionStatus,
}) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [ledgerEntry, setLedgerEntry] = useState<LedgerEntry | null>(null);

  const challengeId = challenge
    ? normalizeScenarioId(challenge as unknown as Record<string, unknown>)
    : null;
  const submitted = submissionStatus?.submitted ?? false;
  const scenarioClosed = Boolean(challenge?.isClosed);

  // Fetch ledger entry (best-effort) to check if results are available
  useEffect(() => {
    if (!challengeId || !user?.id) {
      const timeoutId = setTimeout(() => setLedgerEntry(null), 0);
      return () => clearTimeout(timeoutId);
    }

    let cancelled = false;

    const fetchLedger = async () => {
      try {
        const entryRes = await ledgerService.getEntryForScenarioAndUser(
          challengeId,
          user.id
        );
        if (cancelled) return;
        setLedgerEntry(unwrap(entryRes) as LedgerEntry | null);
      } catch {
        if (cancelled) return;
        setLedgerEntry(null);
      }
    };

    void fetchLedger();

    return () => {
      cancelled = true;
    };
  }, [challengeId, user?.id]);

  const resultsAvailable =
    !!ledgerEntry ||
    String((challenge as unknown as { status?: string })?.status ?? "")
      .toLowerCase()
      .includes("result") ||
    String((challenge as unknown as { status?: string })?.status ?? "")
      .toLowerCase()
      .includes("approved");

  const primaryCta = useMemo(() => {
    if (!challenge || !challengeId) {
      return {
        label: "View challenges",
        disabled: false,
        onClick: () => navigate("/challenges"),
        className: "btn-teal",
      };
    }

    if (resultsAvailable) {
      return {
        label: "View results",
        disabled: false,
        onClick: () => navigate(`/challenge/${challengeId}`),
        className: "btn-teal",
      };
    }

    if (scenarioClosed || submitted) {
      return {
        label: "Waiting for instructor",
        disabled: true,
        onClick: () => {},
        className: "btn-outline",
      };
    }

    return {
      label: "Submit your decisions",
      disabled: false,
      onClick: () => {
        navigate(`/challenges/${challengeId}`);
      },
      className: "btn-teal",
    };
  }, [
    challenge,
    navigate,
    resultsAvailable,
    scenarioClosed,
    challengeId,
    submitted,
  ]);

  const secondaryCta = useMemo(() => {
    if (!scenarioClosed && submitted) {
      return {
        label: "View challenge",
        disabled: false,
        onClick: () => navigate(`/challenges/${challengeId}`),
        className: "btn-outline",
      };
    }
    return null;
  }, [scenarioClosed, submitted, navigate, challengeId]);

  return (
    <div className="card">
      <div className="student-dashboard-week-meta">
        <div className="flex-1 min-w-0">
          <div className="text-text-muted text-sm">Current Challenge</div>
          <div className="student-dashboard-week-title truncate">
            {challenge ? challenge?.title : "No active challenge yet"}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 min-w-0 self-start sm:self-auto">
          {challenge ? (
            <span className="badge badge-success min-w-0 max-w-full whitespace-normal break-words text-center">
              {resultsAvailable
                ? "Results available"
                : scenarioClosed
                ? "Closed (results pending)"
                : submitted
                ? "Submitted"
                : "Open (needs decision)"}
            </span>
          ) : (
            <span className="badge badge-warning min-w-0 max-w-full whitespace-normal break-words text-center">
              Waiting
            </span>
          )}
        </div>
      </div>

      {challenge && (
        <p className="student-dashboard-week-description max-h-24 overflow-y-auto">
          {challenge?.description ||
            "Your instructor will post the challenge details here."}
        </p>
      )}

      {!challenge && (
        <p className="student-dashboard-week-description">
          Check back soon. When your instructor opens a challenge, it will show
          up here with a single action you can take.
        </p>
      )}

      <div className="student-dashboard-primary-cta-row">
        {secondaryCta && (
          <button
            type="button"
            className={secondaryCta.className}
            disabled={secondaryCta.disabled}
            onClick={secondaryCta.onClick}
          >
            {secondaryCta.label}
          </button>
        )}
        <button
          type="button"
          className={primaryCta.className}
          disabled={primaryCta.disabled}
          onClick={primaryCta.onClick}
        >
          {primaryCta.label}
        </button>
      </div>
    </div>
  );
};

export default CurrentScenarioCard;
