import React, { useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { fetchCompletion } from "../../services/completions";
import Alert from "../Alert";

interface AITextFieldProps {
  id: string;
  label: string;
  onChange: (value: string) => void;
  prompt: string;
  value: string;
  promptMode?: "inline" | "modal";
  rows?: number;
  multiline?: boolean;
  LabelClasses?: string;
  InputClasses?: string;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export default function AITextField(props: AITextFieldProps) {
  const {
    id,
    label,
    onChange,
    prompt,
    value,
    promptMode = "inline",
    rows = 1,
    multiline = false,
    LabelClasses,
    InputClasses,
    maxLength,
    ...restProps
  } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");

  const clamp = (nextValue: string) => {
    if (typeof maxLength === "number" && maxLength >= 0) {
      return nextValue.slice(0, maxLength);
    }
    return nextValue;
  };

  const handleValueChange = (nextValue: string) => {
    onChange(clamp(nextValue));
  };

  const disabled = useMemo(() => {
    if (promptMode === "modal") {
      return false;
    }
    return loading || !value || value?.length < 5;
  }, [loading, promptMode, value]);

  const handleInlinePrompt = async () => {
    try {
      setLoading(true);
      if (!value || value.length < 5) {
        setError("Please enter a prompt of at least 5 characters");
        return;
      }

      setError(null);

      const response = await fetchCompletion(prompt + ": " + value);
      handleValueChange(response);
    } catch (err) {
      console.error("Error generating content:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate content"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleModalPrompt = async () => {
    try {
      setLoading(true);
      if (!userPrompt || userPrompt.length < 5) {
        setError("Please enter a prompt of at least 5 characters");
        return;
      }

      setError(null);

      const response = await fetchCompletion(prompt + ": " + userPrompt);
      handleValueChange(response);
      setOpen(false);
      setUserPrompt("");
    } catch (err) {
      console.error("Error generating content:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate content"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (promptMode === "modal") {
      setOpen(true);
    } else {
      await handleInlinePrompt();
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setError(null);
    setUserPrompt("");
  };

  return (
    <>
      <div className="w-full">
        <label
          htmlFor={id}
          className={`label flex inline-block gap-2 ${LabelClasses || ""}`}
        >
          {label}
          <button
            aria-label="AI Generate"
            onClick={handleClick}
            disabled={disabled}
            type="button"
          >
            <i className="pi pi-microchip-ai text-lg text-brand-blue" />
          </button>
        </label>
        {multiline ? (
          <textarea
            id={id}
            value={value}
            rows={rows}
            onChange={(e) => handleValueChange(e.target.value)}
            className={`input mt-1 ${InputClasses || ""}`}
            disabled={props.disabled}
            placeholder={props.placeholder}
            maxLength={maxLength}
            {...restProps}
          />
        ) : (
          <input
            id={id}
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            className={`input mt-1 ${InputClasses || ""}`}
            disabled={props.disabled}
            placeholder={props.placeholder}
            maxLength={maxLength}
            {...restProps}
          />
        )}
      </div>

      {/* Modal Dialog */}
      <Dialog
        header="AI Prompt"
        visible={open}
        onHide={handleCloseDialog}
        modal
        closable={!loading}
        dismissableMask={!loading}
        className="modal w-full max-w-2xl p-3"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="modal-content"
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-end">
            <button
              className="btn-outline"
              onClick={handleCloseDialog}
              disabled={loading}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn-teal"
              onClick={() => void handleModalPrompt()}
              disabled={userPrompt.length < 5 || loading}
              type="button"
            >
              {loading ? "Generating..." : "Generate"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error && (
            <Alert
              variant="error"
              title="Error"
              message={error}
              closable
              onClose={() => setError(null)}
            />
          )}

          <div>
            {loading ? (
              <div
                className="flex items-center justify-center"
                style={{ minHeight: "112px" }}
              >
                <span
                  className="inline-block align-middle animate-spin rounded-full border-4 border-ui-border border-t-brand-teal"
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderTopColor: "var(--color-brand-teal)",
                  }}
                  aria-label="Loading"
                />
              </div>
            ) : (
              <>
                <label className="label" htmlFor="ai-prompt-input">
                  Enter your prompt
                </label>
                <textarea
                  id="ai-prompt-input"
                  className="input"
                  rows={4}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Enter your prompt here..."
                  disabled={loading}
                />
              </>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
