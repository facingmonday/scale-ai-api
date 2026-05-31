import React from "react";
import AITextField from "./AIComponents/AITextField";

export type ScenarioFormValues = {
  title: string;
  description: string;
  publishAt?: string;
  submissionDeadlineAt?: string;
  automationMode?: "MANUAL" | "FULL";
  missingSubmissionPolicy?: "FORWARD_PREVIOUS" | "SKIP";
  punishAbsentStudents?: "high" | "medium" | "low" | "none";
};

interface ScenarioFormProps {
  values: ScenarioFormValues;
  onChange: (next: ScenarioFormValues) => void;
  disabled?: boolean;
}

const ChallengeForm: React.FC<ScenarioFormProps> = ({
  values,
  onChange,
  disabled,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <AITextField
          id="challenge-title"
          label="Title"
          onChange={(value) => onChange({ ...values, title: value })}
          value={values.title}
          prompt="Generate a challenge title"
          promptMode="modal"
          disabled={disabled}
          placeholder="Week 1 — Hiring & Demand"
        />
      </div>

      <div>
        <AITextField
          id="challenge-description"
          label="Description"
          onChange={(value) => onChange({ ...values, description: value })}
          value={values.description}
          prompt="Write a short, engaging challenge description that prepares students for the upcoming week. Include expected weather conditions, notable events happening in town, anticipated foot traffic levels, and any unique circumstances that could affect business operations. The challenge should be realistic but fun, helping students estimate how busy the week will be and think strategically about staffing hours, inventory levels, and overall preparedness. Keep the description short and concise, around 5-7 sentences."
          promptMode="modal"
          disabled={disabled}
          placeholder="Explain what students should consider this week..."
          multiline
          rows={5}
        />
      </div>

      <div className="rounded-lg border border-ui-border bg-ui-surface-muted p-4">
        <div className="mb-3">
          <h3 className="heading-sm">Automation</h3>
          <p className="text-sm text-text-muted">
            Schedule this challenge to open and process automatically.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="label">Start date</span>
            <input
              type="datetime-local"
              className="input"
              value={values.publishAt || ""}
              onChange={(event) =>
                onChange({ ...values, publishAt: event.target.value })
              }
              disabled={disabled}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="label">Decision deadline</span>
            <input
              type="datetime-local"
              className="input"
              value={values.submissionDeadlineAt || ""}
              onChange={(event) =>
                onChange({
                  ...values,
                  submissionDeadlineAt: event.target.value,
                })
              }
              disabled={disabled}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="label">Automation mode</span>
            <select
              className="input"
              value={values.automationMode || "MANUAL"}
              onChange={(event) =>
                onChange({
                  ...values,
                  automationMode: event.target.value as "MANUAL" | "FULL",
                })
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
                onChange({
                  ...values,
                  missingSubmissionPolicy: event.target.value as
                    | "FORWARD_PREVIOUS"
                    | "SKIP",
                })
              }
              disabled={disabled}
            >
              <option value="SKIP">Skip week</option>
              <option value="FORWARD_PREVIOUS">Forward previous</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="label">Punishment for forwarded decisions</span>
            <select
              className="input"
              value={values.punishAbsentStudents || "none"}
              onChange={(event) =>
                onChange({
                  ...values,
                  punishAbsentStudents: event.target.value as
                    | "high"
                    | "medium"
                    | "low"
                    | "none",
                })
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
  );
};

export default ChallengeForm;
