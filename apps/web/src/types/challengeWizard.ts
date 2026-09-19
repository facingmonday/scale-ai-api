import type { ChallengeScheduleValues } from "./challengeSchedule";

export type WizardChallenge = { title: string; description: string };
export type WizardVariable = {
  label: string;
  description: string;
  dataType: "number" | "string" | "boolean";
  inputType:
    | "text"
    | "number"
    | "slider"
    | "knob"
    | "dropdown"
    | "selectbutton"
    | "multiple-choice"
    | "checkbox"
    | "switch";
  options: string[];
  defaultValue: string | number | boolean;
  min: number | null;
  max: number | null;
  required: boolean;
};
export type WizardOutcome = { notes: string; hiddenNotes: string };
export type WizardStep = "challenge" | "variable" | "outcome";
export type WizardCandidate = WizardChallenge | WizardVariable | WizardOutcome;
export type WizardDraft = {
  challenge: WizardChallenge | null;
  variables: WizardVariable[];
  outcome: WizardOutcome | null;
};
export type WizardSchedule = Required<ChallengeScheduleValues> & {
  simulationMode: "direct" | "batch";
  simulationConcurrency: number;
};
export type WizardScheduleProposal = {
  schedule: WizardSchedule;
  timeZone: string;
  explanation: string;
};
export type WizardSuggestionRequest = {
  classroomId: string;
  step: WizardStep;
  draft: Partial<WizardDraft>;
  direction: string;
  rejected: string[];
};
