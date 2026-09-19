import type {
  WizardCandidate,
  WizardChallenge,
  WizardDraft,
  WizardOutcome,
  WizardVariable,
} from "../types/challengeWizard";

export type WizardState = {
  draft: WizardDraft;
  confirmed: [boolean, boolean, boolean];
  step: number;
};
export const initialWizardState = (): WizardState => ({
  draft: { challenge: null, variables: [], outcome: null },
  confirmed: [false, false, false],
  step: 0,
});
export type WizardAction =
  | { type: "challenge"; value: WizardChallenge }
  | { type: "variables"; value: WizardVariable[] }
  | { type: "outcome"; value: WizardOutcome }
  | { type: "confirm"; step: 0 | 1 | 2 }
  | { type: "step"; value: number }
  | { type: "reset" };
export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  if (action.type === "reset") return initialWizardState();
  if (action.type === "step") return { ...state, step: action.value };
  if (action.type === "confirm") {
    const confirmed = [...state.confirmed] as WizardState["confirmed"];
    confirmed[action.step] = true;
    return { ...state, confirmed, step: action.step + 1 };
  }
  const key = action.type === "variables" ? "variables" : action.type;
  if (JSON.stringify(state.draft[key]) === JSON.stringify(action.value))
    return state;
  const from =
    action.type === "challenge" ? 0 : action.type === "variables" ? 1 : 2;
  return {
    ...state,
    draft: { ...state.draft, [key]: action.value },
    confirmed: state.confirmed.map((value, i) =>
      i < from ? value : false,
    ) as WizardState["confirmed"],
  };
}
export function variableError(v: WizardVariable): string | null {
  if (!v.label.trim() || !/[\p{L}\p{N}]/u.test(v.label))
    return "Enter a question containing letters or numbers.";
  if (v.dataType === "number") {
    if (!Number.isFinite(v.defaultValue)) return "Enter a numeric default.";
    if (
      (v.min !== null && !Number.isFinite(v.min)) ||
      (v.max !== null && !Number.isFinite(v.max))
    )
      return "Enter valid numeric bounds.";
    if (v.min !== null && v.max !== null && v.min > v.max)
      return "Minimum must not exceed maximum.";
    if (
      (v.min !== null && Number(v.defaultValue) < v.min) ||
      (v.max !== null && Number(v.defaultValue) > v.max)
    )
      return "Default must be within the range.";
    if (
      ["slider", "knob"].includes(v.inputType) &&
      (v.min === null || v.max === null || v.min === v.max)
    )
      return "Sliders and knobs need a minimum below the maximum.";
  }
  if (
    ["dropdown", "selectbutton", "multiple-choice"].includes(v.inputType) &&
    (!v.options.length || !v.options.includes(String(v.defaultValue)))
  )
    return "Add options and choose a default from those options.";
  if (new Set(v.options).size !== v.options.length)
    return "Options must be unique.";
  return null;
}
export function candidateSummary(candidate: WizardCandidate) {
  return (
    "title" in candidate
      ? `${candidate.title}: ${candidate.description}`
      : "label" in candidate
        ? `${candidate.label}: ${candidate.description}`
        : `${candidate.notes} ${candidate.hiddenNotes}`
  ).slice(0, 800);
}

// Independent from React so cancellation and queue behavior can be tested directly.
export class SuggestionDeck {
  items: WizardCandidate[] = [];
  index = -1;
  loading = false;
  error: string | null = null;
  private key = "";
  private revision = 0;
  private controller: AbortController | null = null;
  private notify: () => void;
  constructor(notify: () => void) {
    this.notify = notify;
  }
  get current() {
    return this.items[this.index] || null;
  }
  get remaining() {
    return this.items.length - this.index - 1;
  }
  configure(key: string) {
    if (this.key === key) return;
    this.cancel();
    this.key = key;
    this.items = [];
    this.index = -1;
    this.error = null;
  }
  cancel() {
    this.revision++;
    this.controller?.abort();
    this.controller = null;
    this.loading = false;
  }
  previous() {
    if (this.index > 0) {
      this.index--;
      this.notify();
    }
    return this.current;
  }
  next() {
    if (this.remaining > 0) {
      this.index++;
      this.notify();
    }
    return this.current;
  }
  async refill(
    fetch: (
      signal: AbortSignal,
      rejected: string[],
    ) => Promise<WizardCandidate[]>,
    selectFirst: (candidate: WizardCandidate) => void,
  ) {
    if (this.loading) return;
    this.controller = new AbortController();
    const controller = this.controller;
    const revision = this.revision;
    this.loading = true;
    this.error = null;
    this.notify();
    try {
      const values = await fetch(
        controller.signal,
        this.items.slice(-12).map(candidateSummary),
      );
      if (controller.signal.aborted || revision !== this.revision) return;
      if (values.length !== 3)
        throw new Error("Unable to load suggestions. Please try again.");
      const empty = this.index < 0;
      this.items = [...this.items, ...values];
      if (empty) {
        this.index = 0;
        selectFirst(values[0]);
      }
    } catch (error) {
      if (!controller.signal.aborted && revision === this.revision)
        this.error =
          error instanceof Error
            ? error.message
            : "Unable to load suggestions. Please try again.";
    } finally {
      if (revision === this.revision) {
        this.loading = false;
        this.controller = null;
        this.notify();
      }
    }
  }
}
