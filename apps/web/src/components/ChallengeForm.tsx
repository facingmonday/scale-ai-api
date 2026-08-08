import React from "react";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import Image from "./AIComponents/Image/Image";

export type ScenarioFormValues = {
  title: string;
  description: string;
  imageUrl?: string;
  publishAt?: string;
  submissionDeadlineAt?: string;
  closeSubmissionsAt?: string;
  processAt?: string;
  feedbackReleaseAt?: string;
  feedbackReleaseMode?: "IMMEDIATE" | "DELAYED" | "MANUAL";
  allowLateSubmissions?: boolean;
  lateSubmissionPolicy?: {
    penaltyPercentPerDay: number;
  };
  automationMode?: "MANUAL" | "FULL";
  missingSubmissionPolicy?: "FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP";
  punishAbsentStudents?: "high" | "medium" | "low" | "none";
};

interface ScenarioFormProps {
  values: ScenarioFormValues;
  onChange: <K extends keyof ScenarioFormValues>(
    field: K,
    value: ScenarioFormValues[K],
  ) => void;
  disabled?: boolean;
  automationError?: string | null;
}

const ChallengeForm: React.FC<ScenarioFormProps> = ({
  values,
  onChange,
  disabled = false,
  automationError,
}) => {
  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row">
      <div className="card mb-4 sm:w-1/4">
        <Image
          src={values.imageUrl || ""}
          context={values.description || ""}
          onAccept={(imageUrl) => onChange("imageUrl", imageUrl)}
          disabled={disabled}
        />
      </div>

      <div className="card mb-4 w-full">
        <div className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="challenge-title">
              Title
            </label>
            <InputText
              id="challenge-title"
              value={values.title}
              onChange={(event) => onChange("title", event.target.value)}
              disabled={disabled}
              className="input"
              placeholder="Week 1 — Hiring & Demand"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="challenge-description">
              Description
            </label>
            <InputTextarea
              id="challenge-description"
              value={values.description}
              onChange={(event) => onChange("description", event.target.value)}
              disabled={disabled}
              autoResize
              className="input"
              placeholder="Explain what students should consider this week..."
              rows={4}
            />
          </div>

          <div
            id="challenge-automation-schedule"
            className="rounded-lg border border-ui-border bg-ui-surface-muted p-4"
          >
            <div className="mb-3">
              <h2 className="heading-sm">Automation</h2>
              <p className="text-sm text-text-muted">
                Configure start, deadline, and automated result generation.
              </p>
            </div>

            {automationError && (
              <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {automationError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="label">Start date</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={values.publishAt || ""}
                  onChange={(event) =>
                    onChange("publishAt", event.target.value)
                  }
                  disabled={disabled}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="label">Submission deadline</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={values.submissionDeadlineAt || ""}
                  onChange={(event) =>
                    onChange("submissionDeadlineAt", event.target.value)
                  }
                  disabled={disabled}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="label">Submissions lock date</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={values.closeSubmissionsAt || ""}
                  onChange={(event) =>
                    onChange("closeSubmissionsAt", event.target.value)
                  }
                  disabled={disabled}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="label">Outcome calculation date</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={values.processAt || ""}
                  onChange={(event) =>
                    onChange("processAt", event.target.value)
                  }
                  disabled={disabled}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="label">Feedback release mode</span>
                <select
                  className="input"
                  value={values.feedbackReleaseMode || "IMMEDIATE"}
                  onChange={(event) =>
                    onChange(
                      "feedbackReleaseMode",
                      event.target.value as
                        | "IMMEDIATE"
                        | "DELAYED"
                        | "MANUAL",
                    )
                  }
                  disabled={disabled}
                >
                  <option value="IMMEDIATE">Immediate (on process)</option>
                  <option value="DELAYED">Delayed (scheduled)</option>
                  <option value="MANUAL">Manual release</option>
                </select>
              </label>

              {values.feedbackReleaseMode === "DELAYED" && (
                <label className="flex flex-col gap-2">
                  <span className="label">Feedback release date</span>
                  <input
                    type="datetime-local"
                    className="input"
                    value={values.feedbackReleaseAt || ""}
                    onChange={(event) =>
                      onChange("feedbackReleaseAt", event.target.value)
                    }
                    disabled={disabled}
                  />
                </label>
              )}

              <label className="flex flex-col gap-2">
                <span className="label">Allow late submissions</span>
                <select
                  className="input"
                  value={values.allowLateSubmissions ? "true" : "false"}
                  onChange={(event) =>
                    onChange(
                      "allowLateSubmissions",
                      event.target.value === "true",
                    )
                  }
                  disabled={disabled}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>

              {values.allowLateSubmissions && (
                <label className="flex flex-col gap-2">
                  <span className="label">Penalty % per day</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    value={
                      values.lateSubmissionPolicy?.penaltyPercentPerDay ?? 0
                    }
                    onChange={(event) =>
                      onChange("lateSubmissionPolicy", {
                        penaltyPercentPerDay: Number(event.target.value),
                      })
                    }
                    disabled={disabled}
                  />
                </label>
              )}

              <label className="flex flex-col gap-2">
                <span className="label">Automation mode</span>
                <select
                  className="input"
                  value={values.automationMode || "MANUAL"}
                  onChange={(event) =>
                    onChange(
                      "automationMode",
                      event.target.value as "MANUAL" | "FULL",
                    )
                  }
                  disabled={disabled}
                >
                  <option value="MANUAL">Manual</option>
                  <option value="FULL">Full automation</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="label">Missing decisions</span>
                <select
                  className="input"
                  value={values.missingSubmissionPolicy || "SKIP"}
                  onChange={(event) =>
                    onChange(
                      "missingSubmissionPolicy",
                      event.target.value as
                        | "FORWARD_PREVIOUS"
                        | "USE_DEFAULTS"
                        | "SKIP",
                    )
                  }
                  disabled={disabled}
                >
                  <option value="SKIP">Skip week</option>
                  <option value="FORWARD_PREVIOUS">Forward previous</option>
                  <option value="USE_DEFAULTS">Use defaults</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="label">
                  Punishment for forwarded decisions
                </span>
                <select
                  className="input"
                  value={values.punishAbsentStudents || "none"}
                  onChange={(event) =>
                    onChange(
                      "punishAbsentStudents",
                      event.target.value as
                        | "high"
                        | "medium"
                        | "low"
                        | "none",
                    )
                  }
                  disabled={disabled}
                >
                  <option value="none">None</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeForm;
