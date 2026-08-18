import React, { useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import challengeService from "../services/challenge";
import { getErrorMessage } from "../utils";

const MIN_PROMPT_LENGTH = 20;
const MAX_PROMPT_LENGTH = 100000;

type Props = {
  visible: boolean;
  classroomId: string;
  onHide: () => void;
  onSuccess: (challengeId: string) => void;
};

const ChallengeCreateWithAI: React.FC<Props> = ({
  visible,
  classroomId,
  onHide,
  onSuccess,
}) => {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(
    () => prompt.trim().length >= MIN_PROMPT_LENGTH,
    [prompt],
  );

  const reset = () => {
    setPrompt("");
    setError(null);
    setIsSubmitting(false);
  };

  const handleHide = () => {
    if (isSubmitting) return;
    reset();
    onHide();
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await challengeService.createWithAI({
        classroomId,
        prompt: prompt.trim(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const challenge = response?.data ?? response;
      const challengeId = challenge?._id ?? challenge?.id;

      if (!challengeId) {
        throw new Error("Challenge creation succeeded but no id was returned.");
      }

      reset();
      onHide();
      onSuccess(String(challengeId));
    } catch (submitError) {
      console.error("Failed to create challenge with AI:", submitError);
      setError(getErrorMessage(submitError));
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      header="Create Challenge with AI"
      visible={visible}
      onHide={handleHide}
      modal
      closable={!isSubmitting}
      dismissableMask={!isSubmitting}
      closeOnEscape={!isSubmitting}
      className="modal w-full max-w-3xl"
      maskClassName="modal-mask"
      headerClassName="modal-header"
      contentClassName="modal-content"
      pt={{
        headerTitle: { className: "modal-title" },
        footer: { className: "modal-footer" },
      }}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={handleHide}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-teal inline-flex items-center gap-2"
            onClick={() => void handleSubmit()}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting && (
              <i className="pi pi-spin pi-spinner" aria-hidden="true" />
            )}
            {isSubmitting ? "Creating Challenge..." : "Submit"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="ai-challenge-prompt">
            Challenge description
          </label>
          <p id="ai-challenge-prompt-help" className="mb-2 text-sm text-text-muted">
            Paste everything you have—the title, scenario, student decisions,
            schedule, and outcome. You can review and edit the generated
            challenge afterward.
          </p>
          <InputTextarea
            id="ai-challenge-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={16}
            autoResize={false}
            disabled={isSubmitting}
            maxLength={MAX_PROMPT_LENGTH}
            aria-describedby="ai-challenge-prompt-help"
            className="input min-h-80 w-full resize-y"
            placeholder="Describe the challenge you want to create..."
          />
          <div className="mt-1 flex justify-between gap-4 text-xs text-text-muted">
            <span>Minimum {MIN_PROMPT_LENGTH} characters</span>
            <span>{prompt.length.toLocaleString()} / {MAX_PROMPT_LENGTH.toLocaleString()}</span>
          </div>
        </div>

        {isSubmitting && (
          <div
            className="flex items-center gap-3 rounded-lg border border-brand-blue/20 bg-brand-blue/10 p-3 text-sm text-text-secondary"
            role="status"
            aria-live="polite"
          >
            <i
              className="pi pi-spin pi-spinner text-xl text-brand-blue"
              aria-hidden="true"
            />
            <span>Generating the challenge details, decisions, and outcome…</span>
          </div>
        )}

        {error && (
          <div
            className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
            role="alert"
          >
            <i className="pi pi-exclamation-circle mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default ChallengeCreateWithAI;
