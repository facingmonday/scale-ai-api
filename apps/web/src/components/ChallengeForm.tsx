import React from "react";
import Image from "./AIComponents/Image/Image";
import AITextField from "./AIComponents/AITextField";

export type ScenarioFormValues = {
  title: string;
  description: string;
  imageUrl?: string;
  publishAt?: string;
  publishMode?: "MANUAL" | "SCHEDULED";
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
  openingLocked?: boolean;
  automationError?: string | null;
}

const ChallengeForm: React.FC<ScenarioFormProps> = ({
  values,
  onChange,
  disabled = false,
  openingLocked = false,
  automationError,
}) => {
  const isFullAutomation = (values.automationMode || "FULL") === "FULL";

  const handlePublishModeChange = (publishMode: "MANUAL" | "SCHEDULED") => {
    onChange("publishMode", publishMode);
    if (publishMode === "MANUAL") onChange("publishAt", "");
  };

  const handleAutomationModeChange = (automationMode: "MANUAL" | "FULL") => {
    onChange("automationMode", automationMode);
    if (
      automationMode === "MANUAL" &&
      values.feedbackReleaseMode === "DELAYED"
    ) {
      onChange("feedbackReleaseMode", "MANUAL");
    }
  };
  const handleSubmissionDeadlineChange = (deadline: string) => {
    onChange("submissionDeadlineAt", deadline);

    if (!deadline) return;
    if (!values.closeSubmissionsAt) {
      onChange("closeSubmissionsAt", deadline);
    }
    if (!values.processAt) {
      onChange("processAt", deadline);
    }
  };

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
            <AITextField
              id="challenge-title"
              label="Title"
              value={values.title}
              onChange={(value) => onChange("title", value)}
              disabled={disabled}
              placeholder="Week 1 — Hiring & Demand"
              prompt="Create a concise, engaging title for a weekly supply-chain business simulation challenge. Include the week number when one is provided. Return only the title without quotation marks"
              promptMode="modal"
            />
          </div>

          <div>
            <AITextField
              id="challenge-description"
              label="Description"
              value={values.description}
              onChange={(value) => onChange("description", value)}
              disabled={disabled}
              placeholder="Explain what students should consider this week..."
              prompt={`Write a clear, student-facing description for the weekly supply-chain simulation challenge titled "${values.title || "Untitled challenge"}". Explain the operating conditions, demand signals, relevant events, and the decisions students should consider. Keep it practical and concise, around 4–6 sentences`}
              promptMode="modal"
              multiline
              rows={4}
            />
          </div>

          <div id="challenge-opening" className="rounded-lg border border-ui-border bg-ui-surface-muted p-4">
            <div className="mb-3">
              <h2 className="heading-sm">Challenge opening</h2>
              <p className="text-sm text-text-muted">
                Choose whether you will publish this challenge or have it open at a scheduled time.
              </p>
            </div>

            {automationError && (
              <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {automationError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="label">Opening method</span>
                <select
                  className="input"
                  value={values.publishMode || "MANUAL"}
                  onChange={(event) =>
                    handlePublishModeChange(
                      event.target.value as "MANUAL" | "SCHEDULED",
                    )
                  }
                  disabled={disabled || openingLocked}
                >
                  <option value="MANUAL">Open manually</option>
                  <option value="SCHEDULED">Open automatically</option>
                </select>
              </label>

              {values.publishMode === "SCHEDULED" && (
                <label className="flex flex-col gap-2">
                  <span className="label">Opening date and time</span>
                  <input
                    type="datetime-local"
                    className="input"
                    value={values.publishAt || ""}
                    onChange={(event) => onChange("publishAt", event.target.value)}
                    disabled={disabled || openingLocked}
                    required
                  />
                </label>
              )}
            </div>

            {openingLocked && (
              <p className="mt-3 text-sm text-text-muted">
                Unpublish this challenge before changing how or when it opens.
              </p>
            )}
          </div>

          <div
            id="challenge-automation-schedule"
            className="rounded-lg border border-ui-border bg-ui-surface-muted p-4"
          >
            <div className="mb-3">
              <h2 className="heading-sm">After opening</h2>
              <p className="text-sm text-text-muted">
                Choose who controls deadlines, result processing, and feedback release.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="label">Lifecycle control</span>
                <select
                  className="input"
                  value={values.automationMode || "FULL"}
                  onChange={(event) =>
                    handleAutomationModeChange(
                      event.target.value as "MANUAL" | "FULL",
                    )
                  }
                  disabled={disabled}
                >
                  <option value="MANUAL">Instructor controlled</option>
                  <option value="FULL">Full automation</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="label">Submission deadline</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={values.submissionDeadlineAt || ""}
                  onChange={(event) => handleSubmissionDeadlineChange(event.target.value)}
                  disabled={disabled}
                />
              </label>

              {isFullAutomation && (
                <>
                  <label className="flex flex-col gap-2">
                    <span className="label">Submissions lock date</span>
                    <input
                      type="datetime-local"
                      className="input"
                      value={values.closeSubmissionsAt || ""}
                      onChange={(event) => onChange("closeSubmissionsAt", event.target.value)}
                      disabled={disabled}
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="label">Outcome calculation date</span>
                    <input
                      type="datetime-local"
                      className="input"
                      value={values.processAt || ""}
                      onChange={(event) => onChange("processAt", event.target.value)}
                      disabled={disabled}
                    />
                  </label>
                </>
              )}

              <label className="flex flex-col gap-2">
                <span className="label">Feedback release mode</span>
                <select
                  className="input"
                  value={values.feedbackReleaseMode || "IMMEDIATE"}
                  onChange={(event) =>
                    onChange(
                      "feedbackReleaseMode",
                      event.target.value as "IMMEDIATE" | "DELAYED" | "MANUAL",
                    )
                  }
                  disabled={disabled}
                >
                  <option value="IMMEDIATE">Immediate (on process)</option>
                  {isFullAutomation && (
                    <option value="DELAYED">Delayed (scheduled)</option>
                  )}
                  <option value="MANUAL">Manual release</option>
                </select>
              </label>

              {isFullAutomation && values.feedbackReleaseMode === "DELAYED" && (
                <label className="flex flex-col gap-2">
                  <span className="label">Feedback release date</span>
                  <input
                    type="datetime-local"
                    className="input"
                    value={values.feedbackReleaseAt || ""}
                    onChange={(event) => onChange("feedbackReleaseAt", event.target.value)}
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
                    onChange("allowLateSubmissions", event.target.value === "true")
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
                    value={values.lateSubmissionPolicy?.penaltyPercentPerDay ?? 0}
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
                <span className="label">Missing decisions</span>
                <select
                  className="input"
                  value={values.missingSubmissionPolicy || "SKIP"}
                  onChange={(event) =>
                    onChange(
                      "missingSubmissionPolicy",
                      event.target.value as "FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP",
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
                <span className="label">Punishment for forwarded decisions</span>
                <select
                  className="input"
                  value={values.punishAbsentStudents || "none"}
                  onChange={(event) =>
                    onChange(
                      "punishAbsentStudents",
                      event.target.value as "high" | "medium" | "low" | "none",
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
