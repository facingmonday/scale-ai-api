import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import ledgerService from "../../../services/ledger";
import challengeService from "../../../services/challenge";
import { useUser } from "@clerk/clerk-react";
import { useAuth } from "../../../context/AuthContext";
import type { LedgerEntry } from "../../../types/ledger";
import type { Challenge } from "../../../types/challenge";
import LoadingOverlay from "../../../components/LoadingOverlay";
import MetricsTable from "../../../components/Metrics/MetricsTable";

const LedgerEntries: React.FC = () => {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { activeClassroom } = useAuth();
  const [entry, setEntry] = useState<LedgerEntry | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const metricDefinitions = useMemo(
    () => activeClassroom?.metricDefinitions ?? [],
    [activeClassroom?.metricDefinitions]
  );

  const fetchLedgerEntry = useCallback(async () => {
    if (!challengeId || !user?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await ledgerService.getEntryForScenarioAndUser(
        challengeId,
        user.id
      );
      const ledgerData = (response?.data || response) as LedgerEntry | null;
      setEntry(ledgerData || null);

      try {
        const challengeResponse = await challengeService.getById(
          challengeId,
          "student"
        );
        const challengeData =
          (challengeResponse.data || challengeResponse) as Challenge;
        setChallenge(challengeData);
      } catch (e) {
        console.error("Failed to fetch challenge:", e);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setEntry(null);
      } else {
        console.error("Failed to fetch ledger entry:", err);
        setError("Failed to load ledger entry");
      }
    } finally {
      setIsLoading(false);
    }
  }, [challengeId, user?.id]);

  useEffect(() => {
    if (challengeId && user?.id) {
      void fetchLedgerEntry();
    }
  }, [challengeId, user?.id, fetchLedgerEntry]);

  if (error) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={fetchLedgerEntry} className="btn-teal">
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
            <div>
              <h1 className="heading-xl mb-2">My Ledger Entry</h1>
              {challenge && (
                <p className="text-text-muted">Challenge: {challenge.title}</p>
              )}
            </div>
            <button
              onClick={() => navigate(`/challenges/${challengeId}`)}
              className="btn-outline"
            >
              Back to Challenge
            </button>
          </div>

          {!entry ? (
            <div className="card text-center py-12">
              <h2 className="heading-lg mb-2">No Ledger Entry Yet</h2>
              <p className="text-text-muted">
                Your ledger entry will appear here after the instructor
                approves the results.
              </p>
            </div>
          ) : (
            <div className="card">
              <MetricsTable
                entries={[entry]}
                definitions={metricDefinitions}
                rowMeta={(e) => ({
                  label: new Date(e.createdDate as Date).toLocaleDateString(),
                  sublabel: challenge?.title,
                })}
                onRowClick={(e) =>
                  navigate(
                    `/challenges/${challengeId}/ledger-entries/${e._id}`
                  )
                }
                periodColumnLabel="Date"
              />
            </div>
          )}
        </div>
      </div>
    </BasicLayout>
  );
};

export default LedgerEntries;
