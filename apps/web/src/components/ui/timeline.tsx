import React from "react";

export interface TimelineProps {
  status?: string;
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ status, className = "" }) => {
  const stages = [
    { key: "SCHEDULED", label: "Scheduled" },
    { key: "acceptingSubmissions", label: "Open" },
    { key: "submissionsClosed", label: "Closed" },
    { key: "processing", label: "Processing" },
    { key: "feedbackReleased", label: "Released" },
  ];

  let activeIndex = -1;
  const lowerStatus = (status || "").toLowerCase();

  if (status === "SCHEDULED") activeIndex = 0;
  else if (status === "acceptingSubmissions") activeIndex = 1;
  else if (status === "submissionsClosed") activeIndex = 2;
  else if (["queuedforprocessing", "processing"].includes(lowerStatus)) activeIndex = 3;
  else if (["processed", "feedbackreleased"].includes(lowerStatus)) activeIndex = 4;

  return (
    <div className={`mt-3 flex items-center justify-between w-full max-w-lg bg-ui-surface-muted/30 p-2.5 rounded-lg border border-ui-border/50 ${className}`}>
      {stages.map((stage, idx) => {
        const isCompleted = idx < activeIndex;
        const isActive = idx === activeIndex;

        return (
          <React.Fragment key={stage.key}>
            {idx > 0 && (
              <div
                className={`flex-1 h-0.5 mx-1.5 ${
                  isCompleted ? "bg-green-500" : isActive ? "bg-brand-blue" : "bg-ui-border"
                }`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-brand-blue text-white ring-2 ring-brand-blue/30"
                    : "bg-ui-surface text-text-muted border border-ui-border"
                }`}
              >
                {isCompleted ? "✓" : idx + 1}
              </div>
              <span
                className={`text-[9px] mt-1 whitespace-nowrap font-medium ${
                  isActive ? "text-brand-blue font-semibold" : "text-text-muted"
                }`}
              >
                {stage.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
