import { useEffect, useRef, useState } from "react";
import challengeService from "../../services/challenge";
import { SuggestionDeck } from "../../utils/challengeWizard";
import type {
  WizardCandidate,
  WizardSuggestionRequest,
} from "../../types/challengeWizard";

export default function SuggestionControls({
  active,
  request,
  hasSelection,
  onSelect,
  direction,
  onDirection,
}: {
  active: boolean;
  request: Omit<WizardSuggestionRequest, "rejected" | "direction">;
  hasSelection: boolean;
  onSelect: (candidate: WizardCandidate) => void;
  direction: string;
  onDirection: (value: string) => void;
}) {
  const [, render] = useState(0);
  const [deck] = useState(() => new SuggestionDeck(() => render((n) => n + 1)));
  const latest = useRef({ onSelect, hasSelection });
  useEffect(() => {
    latest.current = { onSelect, hasSelection };
  });
  const key = JSON.stringify({ ...request, direction });
  const fetchMore = (select = false) =>
    deck.refill(
      (signal, rejected) =>
        challengeService.wizardSuggestions(
          { ...request, direction, rejected },
          signal,
        ),
      (candidate) => {
        if (select || !latest.current.hasSelection)
          latest.current.onSelect(candidate);
      },
    );
  useEffect(() => {
    let disposed = false;
    void Promise.resolve().then(() => {
      if (disposed) return;
      deck.configure(key);
      render((n) => n + 1);
      if (active && !deck.current && !latest.current.hasSelection) {
        const payload = JSON.parse(key) as Omit<
          WizardSuggestionRequest,
          "rejected"
        >;
        void deck.refill(
          (signal, rejected) =>
            challengeService.wizardSuggestions(
              { ...payload, rejected },
              signal,
            ),
          (candidate) => latest.current.onSelect(candidate),
        );
      }
    });
    return () => {
      disposed = true;
      deck.cancel();
    };
  }, [active, key, deck]);

  if (!active) return null;
  const regenerate = async () => {
    if (deck.remaining > 0) {
      const candidate = deck.next();
      if (candidate) onSelect(candidate);
      if (deck.remaining <= 1) void fetchMore();
    } else {
      const previousIndex = deck.index;
      await fetchMore(true);
      if (previousIndex >= 0 && deck.remaining > 0) {
        const candidate = deck.next();
        if (candidate) onSelect(candidate);
      }
    }
  };
  return (
    <div className="space-y-3 border-t border-ui-border pt-4">
      <label className="block">
        <span className="label">Optional direction</span>
        <input
          className="input mt-1 w-full"
          value={direction}
          maxLength={1000}
          onChange={(e) => onDirection(e.target.value)}
          placeholder="For example, focus on inventory or make it harder"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-outline inline-flex items-center gap-2"
          disabled={deck.loading && deck.remaining === 0}
          onClick={() => void regenerate()}
        >
          <i
            className={`pi ${deck.loading && deck.remaining === 0 ? "pi-spin pi-spinner" : "pi-refresh"}`}
            aria-hidden="true"
          />
          {!hasSelection && deck.loading
            ? "Finding suggestions…"
            : "Regenerate"}
        </button>
        <button
          type="button"
          className="btn-outline"
          disabled={deck.index <= 0}
          onClick={() => {
            const value = deck.previous();
            if (value) onSelect(value);
          }}
        >
          Previous suggestion
        </button>
        {deck.loading && hasSelection && (
          <span className="text-xs text-text-muted" role="status">
            Preparing more ideas…
          </span>
        )}
      </div>
      {deck.error && (
        <p className="text-sm text-red-500" role="alert">
          {deck.error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void fetchMore(!hasSelection)}
          >
            Retry suggestions
          </button>
        </p>
      )}
    </div>
  );
}
