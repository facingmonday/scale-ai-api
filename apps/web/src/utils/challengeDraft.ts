import type { UseFormReturn } from "react-hook-form";

type ChallengeDraft = {
  variables: Record<string, unknown>;
  challengeVariableAnswers: Record<string, unknown>;
};

export function persistChallengeDraft(
  form: Pick<UseFormReturn<ChallengeDraft>, "subscribe">,
  key: string | null,
) {
  return form.subscribe({
    formState: { values: true },
    callback: ({ values, type }) => {
      // Ignore hydration and resets, especially the reset after a successful
      // submission; only student input should create a draft.
      if (type === "change") writeChallengeDraft(key, values);
    },
  });
}

export function writeChallengeDraft(key: string | null, values: ChallengeDraft) {
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Storage can be unavailable; keep the live form usable.
  }
}

export function readChallengeDraft(key: string): ChallengeDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || "null");
    const isRecord = (value: unknown) =>
      !!value && typeof value === "object" && !Array.isArray(value);
    return isRecord(draft?.variables) && isRecord(draft?.challengeVariableAnswers)
      ? draft : null;
  } catch {
    return null;
  }
}

export function clearChallengeDraft(key: string | null) {
  if (!key) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // A storage error must not turn a successful submission into an error.
  }
}
