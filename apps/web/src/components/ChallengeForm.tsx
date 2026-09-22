import React from "react";
import ChallengeScheduleFields from "./ChallengeScheduleFields";
import type { ChallengeScheduleValues } from "../types/challengeSchedule";
import ChallengeProcessingFields from "./ChallengeProcessingFields";
import Image from "./AIComponents/Image/Image";
import AITextField from "./AIComponents/AITextField";

export type ScenarioFormValues = ChallengeScheduleValues & {
  simulationMode?: "direct" | "batch";
  simulationConcurrency?: number;
  title: string;
  description: string;
  imageUrl?: string;
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
  showProcessingSettings?: boolean;
}

const ChallengeForm: React.FC<ScenarioFormProps> = ({
  values,
  onChange,
  disabled = false,
  openingLocked = false,
  automationError,
  showProcessingSettings = false,
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

          {showProcessingSettings && (
            <section className="rounded-lg border border-ui-border bg-ui-surface-muted p-4">
              <h2 className="heading-sm mb-3">Result processing</h2>
              <ChallengeProcessingFields
                values={{
                  simulationMode: values.simulationMode || "direct",
                  simulationConcurrency: values.simulationConcurrency ?? 5,
                }}
                onChange={(settings) => {
                  onChange("simulationMode", settings.simulationMode);
                  onChange(
                    "simulationConcurrency",
                    settings.simulationConcurrency,
                  );
                }}
                disabled={disabled}
              />
            </section>
          )}

          <ChallengeScheduleFields
            values={values}
            onChange={(patch) => {
              for (const field of Object.keys(
                patch,
              ) as (keyof ChallengeScheduleValues)[]) {
                onChange(field, patch[field]);
              }
            }}
            disabled={disabled}
            openingLocked={openingLocked}
            automationError={automationError}
          />
        </div>
      </div>
    </div>
  );
};

export default ChallengeForm;
