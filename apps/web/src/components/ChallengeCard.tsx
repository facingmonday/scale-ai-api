import React from "react";
import { useNavigate } from "react-router-dom";
import { Timeline } from "./ui/timeline";

export interface ScenarioListItem {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  isPublished?: boolean;
  isClosed?: boolean;
  isFeedbackReleased?: boolean;
  createdDate?: string | Date;
  createdAt?: string | Date;
  publishAt?: string | Date | null;
  publishMode?: "MANUAL" | "SCHEDULED";
  submissionDeadlineAt?: string | Date | null;
  closeSubmissionsAt?: string | Date | null;
  processAt?: string | Date | null;
  feedbackReleaseAt?: string | Date | null;
  automationMode?: "MANUAL" | "FULL";
  automationStatus?: string;
  automationError?: string | null;
}

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "Not scheduled";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString();
};

export interface ChallengeCardProps {
  challenge: ScenarioListItem;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
}) => {
  const navigate = useNavigate();
  const id = challenge._id || challenge.id || "";
  const title = challenge.title || challenge.name || "Untitled challenge";

  return (
    <div
      className="rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-left hover:border-brand-blue cursor-pointer"
      onClick={() => id && navigate(`/challenges/${id}`)}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-semibold text-text-primary text-base">
              {title}
            </div>
            <div className="flex gap-2">
              <span className="badge badge-muted text-[10px] py-0 px-2">
                {challenge.publishMode === "SCHEDULED"
                  ? "Scheduled opening"
                  : "Manual opening"}
              </span>
              <span className="badge badge-muted text-[10px] py-0 px-2">
                {challenge.automationMode === "FULL"
                  ? "Full automation"
                  : "Instructor controlled"}
              </span>
              <span
                className={`badge text-[10px] py-0 px-2 ${
                  challenge.automationStatus === "feedbackReleased"
                    ? "badge-success"
                    : challenge.automationStatus === "FAILED"
                    ? "badge-danger"
                    : challenge.automationStatus === "BLOCKED"
                    ? "badge-warning"
                    : "badge-muted"
                }`}
              >
                {challenge.automationStatus || "UNSCHEDULED"}
              </span>
            </div>
          </div>
          <div className="text-sm text-text-muted mt-0.5">
            {challenge.publishMode === "SCHEDULED"
              ? `Opens ${formatDateTime(challenge.publishAt)}`
              : "Opens when published"}{" "}
            · Due{" "}
            {formatDateTime(challenge.submissionDeadlineAt)}
          </div>

          {challenge.automationStatus === "BLOCKED" && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded-md border border-yellow-400/20 max-w-fit">
              <i className="pi pi-exclamation-triangle" />
              <span>Outcome Required: {challenge.automationError}</span>
            </div>
          )}

          {challenge.automationStatus === "FAILED" && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 px-2.5 py-1 rounded-md border border-red-400/20 max-w-fit">
              <i className="pi-times-circle" />
              <span>Automation Failed: {challenge.automationError}</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 w-full md:w-auto">
          <Timeline status={challenge.automationStatus} className="mt-0" />
        </div>
      </div>
    </div>
  );
};
