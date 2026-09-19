import { useEffect, useId, useState } from "react";
import { useAuth } from "../context/AuthContext";
import gradebookService from "../services/gradebook";

export default function ChallengePointsField({
  classroomId,
  value,
  onChange,
  disabled = false,
}: {
  classroomId: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
}) {
  const { routes } = useAuth();
  const available = routes?.some((route) => route.key === "gradebook");
  const [open, setOpen] = useState(false);
  const [defaultValue, setDefaultValue] = useState<number | null>(null);
  const inputId = useId();
  useEffect(() => {
    if (!open || !available) return;
    const abort = new AbortController();
    gradebookService
      .settings(classroomId, abort.signal)
      .then((data) => setDefaultValue(data.defaultChallengePoints))
      .catch(() => {});
    return () => abort.abort();
  }, [open, available, classroomId]);
  if (!available) return null;
  return (
    <details
      className="rounded-lg border border-border p-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium">
        Completion points (optional)
      </summary>
      <div className="mt-3">
        <label htmlFor={inputId} className="label">
          Points for this challenge
        </label>
        <input
          id={inputId}
          className="input max-w-52"
          type="number"
          min="0"
          step="0.01"
          value={value ?? ""}
          placeholder={
            defaultValue === null
              ? "Classroom default"
              : `Default: ${defaultValue}`
          }
          disabled={disabled}
          onChange={(event) =>
            onChange(
              event.target.value === ""
                ? undefined
                : Number(event.target.value),
            )
          }
        />
        <p className="mt-2 text-xs text-text-muted">
          Leave blank to use the classroom default. The maximum freezes when the
          challenge is created. Grades are visible only to teachers.
        </p>
      </div>
    </details>
  );
}
