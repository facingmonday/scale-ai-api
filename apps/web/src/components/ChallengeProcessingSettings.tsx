import { useState } from "react";
import ChallengeProcessingFields, {
  type ProcessingSettings,
} from "./ChallengeProcessingFields";
import type { Challenge } from "../types/challenge";
import challengeService from "../services/challenge";
import { getErrorMessage } from "../utils";
import { getChallengeResultState } from "../utils/challengeStatus";

export default function ChallengeProcessingSettings({
  challenge,
  onSaved,
}: {
  challenge: Challenge;
  onSaved: () => void;
}) {
  const resultState = getChallengeResultState(challenge);
  const [values, setValues] = useState<ProcessingSettings>({
    simulationMode: challenge.simulationMode || "batch",
    simulationConcurrency: challenge.simulationConcurrency || 5,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = resultState === "calculating";
  const changed =
    values.simulationMode !== (challenge.simulationMode || "batch") ||
    values.simulationConcurrency !== (challenge.simulationConcurrency || 5);
  const valid =
    Number.isInteger(values.simulationConcurrency) &&
    values.simulationConcurrency >= 1 &&
    values.simulationConcurrency <= 20;
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await challengeService.updateProcessingSettings(
        String(challenge._id || challenge.id),
        values,
      );
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (resultState === "awaitingFeedback" || resultState === "released") {
    return null;
  }

  return (
    <section className="card mb-4" aria-label="Result processing">
      <h2 className="heading-sm mb-3">Result processing</h2>
      <ChallengeProcessingFields
        values={values}
        onChange={setValues}
        disabled={saving || active}
      />
      {active && (
        <p className="mt-3 text-sm text-text-muted">
          Settings are locked while results are queued or calculating.
        </p>
      )}
      {!active && (
        <p className="mt-3 text-sm text-text-muted">
          Changes apply to the next calculation run. Existing results stay
          unchanged until you rerun the challenge.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn-teal mt-3"
        onClick={() => void save()}
        disabled={!changed || !valid || saving || active}
      >
        {saving ? "Saving..." : "Save processing settings"}
      </button>
    </section>
  );
}
