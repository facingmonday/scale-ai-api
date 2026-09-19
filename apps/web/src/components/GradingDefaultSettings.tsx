import { useEffect, useId, useState } from "react";
import { useAuth } from "../context/AuthContext";
import gradebookService from "../services/gradebook";
import { getErrorMessage } from "../utils";

export default function GradingDefaultSettings({
  classroomId,
}: {
  classroomId: string;
}) {
  const { routes } = useAuth();
  const available = routes?.some((route) => route.key === "gradebook");
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputId = useId();
  useEffect(() => {
    if (!open || !available) return;
    const abort = new AbortController();
    gradebookService
      .settings(classroomId, abort.signal)
      .then((data) => {
        setPoints(String(data.defaultChallengePoints));
        setLoaded(true);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(getErrorMessage(e));
      });
    return () => abort.abort();
  }, [classroomId, open, available]);
  if (!available) return null;
  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await gradebookService.updateSettings(classroomId, Number(points));
      setMessage("Default saved for future challenges.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <details
      className="card"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium">
        Default challenge points
      </summary>
      <p className="mt-3 text-sm text-text-muted">
        New challenges use 5 points unless you choose another default. Existing
        challenge maxima stay fixed.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={inputId} className="label">
            Points
          </label>
          <input
            id={inputId}
            type="number"
            min="0"
            step="0.01"
            className="input max-w-40"
            value={points}
            disabled={!loaded || saving}
            onChange={(event) => setPoints(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-outline"
          disabled={!loaded || saving || points === ""}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save default"}
        </button>
      </div>
      {message && (
        <p role="status" className="mt-2 text-sm text-text-secondary">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {error}
        </p>
      )}
    </details>
  );
}
