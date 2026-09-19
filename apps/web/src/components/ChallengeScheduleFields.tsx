import type { ChallengeScheduleValues } from "../types/challengeSchedule";

type Props = {
  values: ChallengeScheduleValues;
  onChange: (patch: Partial<ChallengeScheduleValues>) => void;
  disabled?: boolean;
  openingLocked?: boolean;
  automationError?: string | null;
};

export default function ChallengeScheduleFields({
  values,
  onChange,
  disabled = false,
  openingLocked = false,
  automationError,
}: Props) {
  const set = <K extends keyof ChallengeScheduleValues>(
    field: K,
    value: ChallengeScheduleValues[K],
  ) => onChange({ [field]: value });
  const isFullAutomation = (values.automationMode || "FULL") === "FULL";

  const handlePublishModeChange = (publishMode: "MANUAL" | "SCHEDULED") => {
    onChange({
      publishMode,
      ...(publishMode === "MANUAL" ? { publishAt: "" } : {}),
    });
  };

  const handleAutomationModeChange = (automationMode: "MANUAL" | "FULL") => {
    onChange({
      automationMode,
      ...(automationMode === "MANUAL" &&
      values.feedbackReleaseMode === "DELAYED"
        ? { feedbackReleaseMode: "MANUAL" as const }
        : {}),
    });
  };
  const handleSubmissionDeadlineChange = (deadline: string) => {
    const previousDeadline = values.submissionDeadlineAt;
    const patch: Partial<ChallengeScheduleValues> = {
      submissionDeadlineAt: deadline,
    };
    if (!deadline) {
      onChange(patch);
      return;
    }
    const shouldMoveLock =
      !values.closeSubmissionsAt ||
      values.closeSubmissionsAt === previousDeadline;
    if (shouldMoveLock) {
      patch.closeSubmissionsAt = deadline;
    }
    const effectiveLock = shouldMoveLock ? deadline : values.closeSubmissionsAt;
    if (
      !values.processAt ||
      values.processAt === previousDeadline ||
      (!!effectiveLock && values.processAt < effectiveLock)
    ) {
      patch.processAt = effectiveLock || deadline;
    }
    onChange(patch);
  };

  const handleCloseSubmissionsChange = (closeAt: string) => {
    onChange({
      closeSubmissionsAt: closeAt,
      ...(closeAt && (!values.processAt || values.processAt < closeAt)
        ? { processAt: closeAt }
        : {}),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        id="challenge-opening"
        className="rounded-lg border border-ui-border bg-ui-surface-muted p-4"
      >
        <div className="mb-3">
          <h2 className="heading-sm">Challenge opening</h2>
          <p className="text-sm text-text-muted">
            Choose whether you will publish this challenge or have it open at a
            scheduled time.
          </p>
        </div>

        {automationError && (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {automationError}
          </div>
        )}

        <div className="challenge-schedule-fields">
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
                onChange={(event) => set("publishAt", event.target.value)}
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
            Choose who controls deadlines, result processing, and feedback
            release.
          </p>
        </div>

        <div className="challenge-schedule-fields">
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
              onChange={(event) =>
                handleSubmissionDeadlineChange(event.target.value)
              }
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
                  onChange={(event) =>
                    handleCloseSubmissionsChange(event.target.value)
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
                  onChange={(event) => set("processAt", event.target.value)}
                  min={values.closeSubmissionsAt || undefined}
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
                set(
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
                onChange={(event) =>
                  set("feedbackReleaseAt", event.target.value)
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
                set("allowLateSubmissions", event.target.value === "true")
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
                  set("lateSubmissionPolicy", {
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
                set(
                  "missingSubmissionPolicy",
                  event.target.value as
                    "FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP",
                )
              }
              disabled={disabled}
            >
              <option value="SKIP">Skip week</option>
              <option value="FORWARD_PREVIOUS">Forward previous</option>
              <option value="USE_DEFAULTS">Use defaults</option>
            </select>
          </label>

          {(values.missingSubmissionPolicy || "SKIP") !== "SKIP" && (
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="label">Punishment for missing decisions</span>
              <select
                className="input"
                value={values.punishAbsentStudents || "none"}
                onChange={(event) =>
                  set(
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
          )}
        </div>
      </div>
    </div>
  );
}
