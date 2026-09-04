import type {
  StudentExplanationValue,
  StudentResultExplanation as StudentResultExplanationType,
} from "@/types/ledger";
import { formatDisplayValue } from "@/utils/formatDisplayValue";

type Props = {
  explanation?: StudentResultExplanationType | null;
};

const impactClass = {
  positive: "border-green-500/25 bg-green-500/5",
  negative: "border-red-500/25 bg-red-500/5",
  mixed: "border-brand-orange/25 bg-brand-orange/5",
  neutral: "border-ui-border bg-ui-muted/30",
};

function ValuesSection({
  title,
  values,
}: {
  title: string;
  values: StudentExplanationValue[];
}) {
  if (!values.length) return null;
  return (
    <section>
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {values.map((item) => (
          <div
            key={`${title}-${item.key}`}
            className="rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
          >
            <dt className="text-xs text-text-muted">{item.label}</dt>
            <dd className="mt-1 font-medium text-text-primary">
              {formatDisplayValue(item.value)}
            </dd>
            {item.description && (
              <p className="mt-1 text-xs leading-5 text-text-muted">
                {item.description}
              </p>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function StudentResultExplanation({ explanation }: Props) {
  if (!explanation) return null;
  const details = explanation.details;

  return (
    <section className="card" aria-labelledby="student-result-explanation-heading">
      <div className="flex items-center gap-2">
        <i className="pi pi-compass text-xl text-brand-teal" aria-hidden />
        <h2 id="student-result-explanation-heading" className="heading-md">
          How your result was determined
        </h2>
      </div>

      {explanation.overview && (
        <p className="mt-3 whitespace-pre-wrap leading-6 text-text-secondary">
          {explanation.overview}
        </p>
      )}

      {explanation.keyDrivers.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-text-primary">Key drivers</h3>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {explanation.keyDrivers.map((driver, index) => (
              <article
                key={`${driver.title}-${index}`}
                className={`rounded-xl border p-4 ${impactClass[driver.impact]}`}
              >
                <div className="font-semibold text-text-primary">{driver.title}</div>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {driver.explanation}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {explanation.nextActions.length > 0 && (
        <div className="mt-5 rounded-xl border border-brand-teal/20 bg-brand-teal/5 p-4">
          <h3 className="text-sm font-semibold text-text-primary">
            What to try next
          </h3>
          <ol className="mt-3 space-y-3">
            {explanation.nextActions.map((action, index) => (
              <li key={`${action.title}-${index}`} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <div className="font-medium text-text-primary">{action.title}</div>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    {action.rationale}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <details className="mt-5 rounded-xl border border-ui-border bg-ui-muted/20">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-teal">
          View inputs, constraints, and calculations
        </summary>
        <div className="space-y-5 border-t border-ui-border p-4">
          <ValuesSection title="Starting position" values={details.startingState} />
          <ValuesSection title="Profile constraints" values={details.profileConstraints} />
          <ValuesSection title="Challenge context" values={details.challengeContext} />
          <ValuesSection title="Your decisions" values={details.decisions} />

          {(details.publicOutcome.notes || details.publicOutcome.values.length > 0) && (
            <section>
              <h4 className="text-sm font-semibold text-text-primary">
                What happened this week
              </h4>
              {details.publicOutcome.notes && (
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {details.publicOutcome.notes}
                </p>
              )}
              <div className="mt-3">
                <ValuesSection title="Public outcome values" values={details.publicOutcome.values} />
              </div>
            </section>
          )}

          {details.randomEvent && (
            <section>
              <h4 className="text-sm font-semibold text-text-primary">Random event</h4>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {details.randomEvent}
              </p>
            </section>
          )}

          <ValuesSection title="Final metrics" values={details.finalMetrics} />

          {details.deterministicCalculations.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-text-primary">
                Platform-enforced calculations
              </h4>
              <div className="mt-2 space-y-2">
                {details.deterministicCalculations.map((calculation) => (
                  <div
                    key={calculation.key}
                    className="rounded-lg border border-ui-border bg-ui-surface px-3 py-2"
                  >
                    <div className="font-medium text-text-primary">
                      {calculation.label}
                    </div>
                    <div className="mt-1 font-mono text-xs text-text-muted">
                      {calculation.expression}
                    </div>
                    {calculation.key === "cash_continuity" && (
                      <div className="mt-2 text-sm font-medium text-text-secondary">
                        {formatDisplayValue(calculation.values.cashBefore)} +{" "}
                        {formatDisplayValue(calculation.values.netProfit)} ={" "}
                        {formatDisplayValue(calculation.values.cashAfter)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="text-xs leading-5 text-text-muted">
            {explanation.modeledOutcomeNotice}
          </p>
        </div>
      </details>
    </section>
  );
}
