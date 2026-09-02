import React, { useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import type {
  ChallengePreviewCase,
  ChallengePreviewResponse,
  ChallengePreviewTarget,
  ChallengePreviewValue,
} from "@/types/challenge";
import type { ClassroomReadiness } from "@/types/readiness";
import { formatMetricValue } from "@/utils/formatMetric";

type Props = {
  visible: boolean;
  loading: boolean;
  result: ChallengePreviewResponse | null;
  readiness: ClassroomReadiness | null;
  error: string | null;
  onHide: () => void;
  onRetry: (target: ChallengePreviewTarget) => Promise<void>;
};

const ValueList: React.FC<{
  title: string;
  values: ChallengePreviewValue[];
}> = ({ title, values }) => {
  if (values.length === 0) return null;
  return (
    <div>
      <h5 className="text-sm font-semibold mb-2">{title}</h5>
      <div className="divide-y divide-card-border rounded-md border border-card-border px-3">
        {values.map((item) => (
          <div
            className="flex items-start justify-between gap-4 py-2 text-sm"
            key={`${title}-${item.key}`}
          >
            <div>
              <div className="font-medium">{item.label}</div>
              {item.description ? (
                <div className="text-xs text-text-muted">{item.description}</div>
              ) : null}
            </div>
            <div className="font-mono text-right break-all">
              {typeof item.value === "object"
                ? JSON.stringify(item.value)
                : String(item.value ?? "—")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PreviewCaseCard: React.FC<{
  previewCase: ChallengePreviewCase;
  result: ChallengePreviewResponse;
  onRetry: (target: ChallengePreviewTarget) => Promise<void>;
}> = ({ previewCase, result, onRetry }) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const metricDefinitions = useMemo(
    () =>
      [...result.metricDefinitions].sort((left, right) => {
        const orderDifference = (left.sortOrder || 0) - (right.sortOrder || 0);
        return orderDifference !== 0
          ? orderDifference
          : left.label.localeCompare(right.label);
      }),
    [result.metricDefinitions],
  );
  const label =
    previewCase.case === "baseline"
      ? "Default baseline"
      : `Absence penalty (${result.assumptions.punishmentLevel || "configured"})`;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry({
        profileTypeId: previewCase.profileTypeId,
        case: previewCase.case,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="rounded-lg border border-card-border bg-card p-4 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="font-semibold">{label}</h4>
        <span
          className={
            previewCase.status === "completed" ? "badge-success" : "badge-warning"
          }
        >
          {previewCase.status === "completed" ? "Completed" : "Failed"}
        </span>
      </div>

      {previewCase.status === "failed" ? (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-300">
            {previewCase.error?.message || "This preview case could not be generated."}
          </p>
          {previewCase.error?.retryable ? (
            <button
              className="btn-outline mt-3"
              type="button"
              disabled={isRetrying}
              onClick={() => void handleRetry()}
            >
              {isRetrying ? "Retrying..." : "Retry this case"}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="divide-y divide-card-border">
            {metricDefinitions.map((definition) => (
              <div
                className="flex items-start justify-between gap-4 py-2"
                key={`${previewCase.case}-${definition.key}`}
              >
                <div>
                  <div className="text-sm font-medium">{definition.label}</div>
                  {definition.description ? (
                    <div className="text-xs text-text-muted">
                      {definition.description}
                    </div>
                  ) : null}
                </div>
                <div className="font-mono text-sm whitespace-nowrap">
                  {formatMetricValue(
                    previewCase.result?.metrics[definition.key],
                    definition,
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-card-hover p-3">
            <h5 className="text-sm font-semibold mb-1">Modeled summary</h5>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">
              {previewCase.result?.summary || "—"}
            </p>
          </div>
        </>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-brand-teal">
          Inputs used
        </summary>
        <div className="mt-3 space-y-4">
          <ValueList
            title="Synthetic starting position"
            values={previewCase.inputs.startingPosition}
          />
          <ValueList title="Store-type profile" values={previewCase.inputs.profile} />
          <ValueList title="Challenge inputs" values={previewCase.inputs.challenge} />
          <ValueList title="Default decisions" values={previewCase.inputs.decisions} />
          <ValueList title="Outcome inputs" values={previewCase.inputs.outcome} />
          {previewCase.inputs.outcomeNotes ? (
            <div>
              <h5 className="text-sm font-semibold mb-1">Outcome notes</h5>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {previewCase.inputs.outcomeNotes}
              </p>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
};

const ChallengePreviewDialog: React.FC<Props> = ({
  visible,
  loading,
  result,
  readiness,
  error,
  onHide,
  onRetry,
}) => {
  const failedChecks =
    readiness?.checks.filter((item) => item.status === "fail") ?? [];

  return (
    <Dialog
      header="Challenge outcome preview"
      visible={visible}
      onHide={onHide}
      modal
      dismissableMask={!loading}
      closeOnEscape={!loading}
      closable={!loading}
      className="modal w-[min(96vw,90rem)]"
      maskClassName="modal-mask"
      headerClassName="modal-header"
      contentClassName="modal-content"
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/10 p-4">
          <p className="font-medium">Synthetic teaching preview</p>
          <p className="mt-1 text-sm text-text-secondary">
            Each store type starts from its Week 0 defaults and uses the same
            default decisions. These are fresh modeled outcomes—not predictions
            for an individual student. No decisions, jobs, or ledger results are saved.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3" role="status">
            <i className="pi pi-spin pi-spinner text-2xl text-brand-teal" />
            <span>Running synthetic store-type simulations…</span>
          </div>
        ) : null}

        {!loading && failedChecks.length > 0 ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <h3 className="font-semibold text-red-300">Preview is blocked</h3>
            <div className="mt-3 space-y-3">
              {failedChecks.map((item) => (
                <div key={item.key}>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-text-secondary">{item.message}</p>
                  {item.action ? (
                    <a className="mt-1 inline-block text-sm text-brand-teal" href={item.action.href}>
                      {item.action.label}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && error && failedChecks.length === 0 ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {!loading && result ? (
          <>
            {result.status === "partial" ? (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm">
                Some cases could not be generated. Successful results are shown
                below, and failed cases can be retried individually.
              </div>
            ) : null}
            {!result.assumptions.punishmentLevel ? (
              <p className="text-sm text-text-muted">
                No absence punishment is configured, so only the neutral default
                baseline is shown.
              </p>
            ) : null}
            <div className="space-y-6">
              {result.profileTypes.map((profileTypePreview) => (
                <section key={profileTypePreview.profileType.id}>
                  <div className="mb-3">
                    <h3 className="heading-md">{profileTypePreview.profileType.label}</h3>
                    {profileTypePreview.profileType.description ? (
                      <p className="text-sm text-text-muted">
                        {profileTypePreview.profileType.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {profileTypePreview.cases.map((previewCase) => (
                      <PreviewCaseCard
                        key={`${profileTypePreview.profileType.id}-${previewCase.case}`}
                        previewCase={previewCase}
                        result={result}
                        onRetry={onRetry}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
};

export default ChallengePreviewDialog;
