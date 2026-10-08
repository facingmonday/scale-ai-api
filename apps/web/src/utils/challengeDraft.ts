import type { UseFormReturn } from "react-hook-form";

type ChallengeDraft = {
  variables: Record<string, unknown>;
  challengeVariableAnswers: Record<string, unknown>;
};

export function persistChallengeDraft(
  form: Pick<UseFormReturn<ChallengeDraft>, "watch">,
  key: string | null,
  onEdit?: () => void,
) {
  // watch receives the original event metadata. subscribe merges formState and
  // can retain a previous event's `type: change` on hydration/reset events.
  const subscription = form.watch((values, { type }) => {
    if (type !== "change") return;
    onEdit?.();
    writeChallengeDraft(key, {
      variables: values.variables ?? {},
      challengeVariableAnswers: values.challengeVariableAnswers ?? {},
    });
  });
  return () => subscription.unsubscribe();
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
