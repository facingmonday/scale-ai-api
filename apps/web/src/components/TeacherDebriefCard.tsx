import type { TeacherDebrief } from "@/types/challenge";

type Props = {
  debrief?: TeacherDebrief;
  isGenerating: boolean;
  onGenerate: () => void;
};

const TeacherDebriefCard = ({
  debrief,
  isGenerating,
  onGenerate,
}: Props) => {
  const hasSummary = Boolean(debrief?.summary);
  const isProcessing = isGenerating || debrief?.status === "processing";

  return (
    <section className="card" aria-labelledby="teacher-debrief-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <i className="pi pi-sparkles text-xl text-brand-blue" />
            <h2 id="teacher-debrief-heading" className="heading-md">
              Challenge Debrief
            </h2>
          </div>
          <p className="text-text-muted text-sm">
            AI analysis of anonymized cohort results for teacher discussion.
          </p>
        </div>
        <button
          type="button"
          className="btn-outline shrink-0"
          onClick={onGenerate}
          disabled={isProcessing}
        >
          {isProcessing
            ? "Generating debrief..."
            : hasSummary
              ? "Regenerate debrief"
              : "Generate debrief"}
        </button>
      </div>

      {hasSummary ? (
        <p className="mt-4 whitespace-pre-wrap leading-relaxed">
          {debrief?.summary}
        </p>
      ) : isProcessing ? (
        <p className="mt-4 text-text-muted">Analyzing cohort results…</p>
      ) : debrief?.status === "failed" ? (
        <p className="mt-4 text-red-400">
          The debrief could not be generated. Try again.
        </p>
      ) : (
        <p className="mt-4 text-text-muted">
          No debrief has been generated yet.
        </p>
      )}

      {debrief?.generatedAt && hasSummary && (
        <p className="mt-3 text-xs text-text-muted">
          Generated {new Date(debrief.generatedAt).toLocaleString()}
        </p>
      )}
    </section>
  );
};

export default TeacherDebriefCard;
