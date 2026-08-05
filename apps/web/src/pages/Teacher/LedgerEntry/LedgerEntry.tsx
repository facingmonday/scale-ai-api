import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import ledgerService from "../../../services/ledger";
import challengeService from "../../../services/challenge";
import LedgerVisualization from "../../../components/LedgerVisualization";
import type { LedgerEntry as LedgerEntryType, CalculationDetails } from "../../../types/ledger";
import type { Challenge } from "../../../types/challenge";
import LoadingOverlay from "../../../components/LoadingOverlay";

const LedgerEntry: React.FC = () => {
  const { challengeId, ledgerEntryId } = useParams<{
    challengeId: string;
    ledgerEntryId: string;
  }>();
  const navigate = useNavigate();
  const [ledgerEntry, setLedgerEntry] = useState<LedgerEntryType | null>(null);
  const [challenge, setScenario] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLedgerEntry = useCallback(async () => {
    if (!ledgerEntryId) return;

    setIsLoading(true);
    setError(null);
    try {
      // Fetch calculation details which includes the ledger entry
      const detailsResponse = await ledgerService.getCalculationDetails(
        ledgerEntryId,
        true
      );
      const details = (detailsResponse?.data ||
        detailsResponse) as CalculationDetails;
      setLedgerEntry(details.ledgerEntry);

      // Fetch challenge if we have a challengeId
      if (challengeId) {
        try {
          const scenarioResponse = await challengeService.getById(
            challengeId,
            "admin"
          );
          const scenarioData =
            (scenarioResponse.data || scenarioResponse) as Challenge;
          setScenario(scenarioData);
        } catch (scenarioErr) {
          console.error("Failed to fetch challenge:", scenarioErr);
        }
      }
    } catch (err) {
      console.error("Failed to fetch ledger entry:", err);
      setError("Failed to load ledger entry");
    } finally {
      setIsLoading(false);
    }
  }, [ledgerEntryId, challengeId]);

  useEffect(() => {
    if (ledgerEntryId) {
      void fetchLedgerEntry();
    }
  }, [ledgerEntryId, fetchLedgerEntry]);

  const handleUpdate = () => {
    void fetchLedgerEntry();
  };

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

  if (!ledgerEntry) {
    return (
      <BasicLayout>
        <LoadingOverlay loading={isLoading} />
        <div className="page">
          <div className="container">
            <div className="card text-center py-12">
              <h2 className="heading-lg mb-2">Ledger Entry Not Found</h2>
              <p className="text-text-muted">
                The ledger entry you're looking for doesn't exist.
              </p>
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
              <h1 className="heading-xl mb-2">Ledger Entry Details</h1>
              {challenge && (
                <p className="text-text-muted">
                  Challenge: {challenge.title}
                </p>
              )}
            </div>
            <button
              onClick={() =>
                navigate(`/challenges/${challengeId}/ledger-entries`)
              }
              className="btn-outline"
            >
              Back to Entries
            </button>
          </div>

          <div className="space-y-6">
            <LedgerVisualization
              ledger={ledgerEntry}
              onUpdate={handleUpdate}
            />
          </div>
        </div>
      </div>
    </BasicLayout>
  );
};

export default LedgerEntry;
