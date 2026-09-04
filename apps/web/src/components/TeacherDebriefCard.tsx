import type { TeacherDebrief } from "@/types/challenge";

type Props = {
  debrief?: TeacherDebrief;
  isGenerating: boolean;
  onGenerate: () => void;
};

function DebriefList({
  title,
  items,
  icon,
}: {
  title: string;
  items?: string[];
  icon: string;
}) {
  if (!items?.length) return null;
  return (
    <section className="rounded-xl border border-ui-border bg-ui-muted/25 p-4">
      <h3 className="flex items-center gap-2 font-semibold text-text-primary">
        <i className={`${icon} text-brand-blue`} aria-hidden />
        {title}
      </h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-text-secondary">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

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
        <>
          <div className="mt-4 rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Overall outcome
            </h3>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-text-secondary">
              {debrief?.summary}
            </p>
          </div>

          <div className="mt-4 !grid gap-3 lg:grid-cols-3">
            <DebriefList
              title="Patterns associated with stronger results"
              items={debrief?.strongerPatterns}
              icon="pi pi-arrow-up-right"
            />
            <DebriefList
              title="Patterns associated with weaker results"
              items={debrief?.weakerPatterns}
              icon="pi pi-arrow-down-right"
            />
            <DebriefList
              title="Expected variation"
              items={debrief?.expectedVariation}
              icon="pi pi-chart-line"
            />
            <DebriefList
              title="Suspicious anomalies"
              items={debrief?.suspiciousAnomalies}
              icon="pi pi-exclamation-triangle"
            />
            <DebriefList
              title="Common mistakes"
              items={debrief?.commonMistakes}
              icon="pi pi-times-circle"
            />
            <DebriefList
              title="Suggested interventions"
              items={debrief?.suggestedInterventions}
              icon="pi pi-lightbulb"
            />
          </div>

          <div className="mt-4">
            <DebriefList
              title="Discussion questions"
              items={debrief?.discussionQuestions}
              icon="pi pi-comments"
            />
          </div>

          {(debrief?.profileTypeSummaries?.length ?? 0) > 0 && (
            <section className="mt-5">
              <div className="mb-3">
                <h3 className="heading-md">Store-type summaries</h3>
                <p className="mt-1 text-sm text-text-muted">
                  Anonymized patterns and teaching opportunities for each store type.
                </p>
              </div>
              <div className="!grid gap-3 lg:grid-cols-3">
                {debrief?.profileTypeSummaries?.map((profileType) => (
                  <article
                    key={profileType.key || profileType.label}
                    className="rounded-xl border border-ui-border bg-ui-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold text-text-primary">
                        {profileType.label}
                      </h4>
                      <span className="badge badge-muted whitespace-nowrap">
                        {profileType.participantCount} result
                        {profileType.participantCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      {profileType.summary}
                    </p>
                    {profileType.strengths.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-green-500">
                          Strengths
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                          {profileType.strengths.map((item, index) => (
                            <li key={`strength-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {profileType.risks.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-brand-orange">
                          Risks
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                          {profileType.risks.map((item, index) => (
                            <li key={`risk-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {profileType.recommendedFocus.length > 0 && (
                      <div className="mt-3 rounded-lg bg-brand-teal/5 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-brand-teal">
                          Recommended focus
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                          {profileType.recommendedFocus.map((item, index) => (
                            <li key={`focus-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
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
