import React, { useMemo, useState } from "react";

interface JsonRendererProps {
  value: unknown;
  copyLabel?: string;
}

const JsonRenderer: React.FC<JsonRendererProps> = ({
  value,
  copyLabel = "Copy JSON",
}) => {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const byteCount = useMemo(
    () => new TextEncoder().encode(JSON.stringify(value)).length,
    [value]
  );

  const handleCopy = async () => {
    if (!json) return;

    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy JSON:", error);
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-ui-border bg-ui-muted">
      <div className="flex items-center justify-between gap-3 border-b border-ui-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          <span>JSON</span>
          <span aria-label={`${byteCount.toLocaleString()} bytes`}>
            {byteCount.toLocaleString()} bytes
          </span>
        </div>
        <button
          type="button"
          className="btn-outline btn-xs"
          disabled={!json}
          onClick={() => void handleCopy()}
        >
          {copied ? "Copied" : copyLabel}
        </button>
      </div>
      <pre className="max-h-[42rem] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5 text-text-primary">
        {json || "null"}
      </pre>
    </div>
  );
};

export default JsonRenderer;
