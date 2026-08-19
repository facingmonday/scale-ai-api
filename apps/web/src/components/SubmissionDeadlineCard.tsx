import React, { useEffect, useMemo, useState } from "react";

type Props = {
  deadline: Date;
};

type CountdownPart = {
  label: string;
  value: number;
};

const SECOND = 1_000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * HOUR;

function getCountdownParts(millisecondsRemaining: number): CountdownPart[] {
  const totalSeconds = Math.max(0, Math.floor(millisecondsRemaining / SECOND));

  return [
    { label: "Days", value: Math.floor(totalSeconds / 86_400) },
    { label: "Hours", value: Math.floor((totalSeconds % 86_400) / 3_600) },
    { label: "Minutes", value: Math.floor((totalSeconds % 3_600) / 60) },
    { label: "Seconds", value: totalSeconds % 60 },
  ];
}

const SubmissionDeadlineCard: React.FC<Props> = ({ deadline }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), SECOND);
    return () => window.clearInterval(intervalId);
  }, [deadline]);

  const millisecondsRemaining = deadline.getTime() - now;
  const isExpired = millisecondsRemaining <= 0;
  const countdownParts = getCountdownParts(millisecondsRemaining);

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(deadline),
    [deadline]
  );
  const formattedTime = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(deadline),
    [deadline]
  );

  const urgency = isExpired
    ? {
        label: "Deadline reached",
        icon: "pi pi-lock",
        border: "border-l-red-500",
        badge: "bg-red-500/10 text-red-400",
      }
    : millisecondsRemaining <= HOUR
      ? {
          label: "Final hour",
          icon: "pi pi-bolt",
          border: "border-l-red-500",
          badge: "bg-red-500/10 text-red-400",
        }
      : millisecondsRemaining <= DAY
        ? {
            label: "Due soon",
            icon: "pi pi-bell",
            border: "border-l-brand-orange",
            badge: "bg-brand-orange/10 text-brand-orange",
          }
        : {
            label: "Time remaining",
            icon: "pi pi-clock",
            border: "border-l-brand-blue",
            badge: "bg-brand-blue/10 text-text-brand",
          };

  return (
    <section
      className={`mb-6 rounded-lg border border-l-4 border-ui-border bg-ui-surface px-5 py-4 shadow-sm ${urgency.border}`}
      aria-labelledby="submission-deadline-title"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <i className="pi pi-calendar text-text-brand" aria-hidden="true" />
            <h2 id="submission-deadline-title" className="heading-md">
              Submission Deadline
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${urgency.badge}`}
            >
              <i className={`${urgency.icon} text-[11px]`} aria-hidden="true" />
              {urgency.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-text-secondary">
            {isExpired ? "Closed" : "Due"}{" "}
            <time
              dateTime={deadline.toISOString()}
              className="font-semibold text-text-primary"
            >
              {formattedDate} at {formattedTime}
            </time>
          </p>
        </div>

        <div
          className="grid shrink-0 grid-cols-4 overflow-hidden rounded-lg border border-ui-border bg-ui-muted/30"
          role="timer"
          aria-label={
            isExpired
              ? "Submission deadline reached"
              : `${countdownParts[0].value} days, ${countdownParts[1].value} hours, ${countdownParts[2].value} minutes, and ${countdownParts[3].value} seconds remaining`
          }
        >
          {countdownParts.map((part) => (
            <div
              key={part.label}
              className="min-w-0 border-r border-ui-border px-3 py-2 text-center last:border-r-0 sm:px-4"
            >
              <div className="font-mono text-lg font-bold leading-none tabular-nums text-text-primary sm:text-xl">
                {String(part.value).padStart(2, "0")}
              </div>
              <div className="mt-1 truncate text-[9px] font-semibold uppercase tracking-wide text-text-muted sm:text-[10px]">
                {part.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SubmissionDeadlineCard;
