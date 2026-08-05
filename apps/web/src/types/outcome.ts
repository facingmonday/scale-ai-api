import type { BaseSchema } from "./base";

/**
 * Outcome model
 */
export interface Outcome extends BaseSchema {
  challengeId: string; // Challenge ObjectId reference (unique)
  notes: string;
  hiddenNotes: string;
  randomEventChancePercent: number; // 0-100, default 0
  autoGenerateSubmissionsOnOutcome:
    | "USE_AI"
    | "FORWARD_PREVIOUS"
    | "USE_DEFAULTS"
    | "SKIP"
    | null;
  punishAbsentStudents: "high" | "medium" | "low" | "none" | null;
}
