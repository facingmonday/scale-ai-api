import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import ledgerService from "../../../services/ledger";
import challengeService from "../../../services/challenge";
import { useAuth } from "../../../context/AuthContext";
import type { LedgerEntry } from "../../../types/ledger";
import type { Challenge } from "../../../types/challenge";
import LoadingOverlay from "../../../components/LoadingOverlay";
import MetricsTable from "../../../components/Metrics/MetricsTable";

const LedgerEntries: React.FC = () => {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { activeClassroom } = useAuth();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const metricDefinitions = useMemo(
    () => activeClassroom?.metricDefinitions ?? [],
    [activeClassroom?.metricDefinitions]
  );

  const fetchLedgerEntries = useCallback(async () => {
    if (!challengeId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await ledgerService.getEntriesForScenario(challengeId);
      const ledgerData = response?.data || response || [];
      setEntries(Array.isArray(ledgerData) ? ledgerData : []);

      try {
        const challengeResponse = await challengeService.getById(
          challengeId,
          "admin"
        );
        const challengeData =
          (challengeResponse.data || challengeResponse) as Challenge;
        setChallenge(challengeData);
      } catch (e) {
        console.error("Failed to fetch challenge:", e);
      }
    } catch (err) {
      console.error("Failed to fetch ledger entries:", err);
      setError("Failed to load ledger entries");
    } finally {
      setIsLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    if (challengeId) {
      void fetchLedgerEntries();
    }
  }, [challengeId, fetchLedgerEntries]);

  if (error) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={fetchLedgerEntries} className="btn-teal">
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
              <h1 className="heading-xl mb-2">Ledger Entries</h1>
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

          {entries.length === 0 ? (
            <div className="card text-center py-12">
              <h2 className="heading-lg mb-2">No Ledger Entries</h2>
              <p className="text-text-muted">
                There are no ledger entries for this challenge yet. Results
                will appear here after the challenge is approved.
              </p>
            </div>
          ) : (
            <div className="card">
              <MetricsTable
                entries={entries}
                definitions={metricDefinitions}
                rowMeta={(entry) => {
                  const user = (entry as unknown as { user?: { name?: string; firstName?: string; lastName?: string; email?: string } }).user;
                  const name = user
                    ? user.name ||
                      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                      user.email ||
                      "Unknown"
                    : entry.userId || "—";
                  return {
                    label: name,
                    sublabel: new Date(
                      entry.createdDate as Date
                    ).toLocaleDateString(),
                  };
                }}
                onRowClick={(entry) =>
                  navigate(
                    `/challenges/${challengeId}/ledger-entries/${entry._id}`
                  )
                }
                periodColumnLabel="Student"
              />
            </div>
          )}
        </div>
      </div>
    </BasicLayout>
  );
};

export default LedgerEntries;
