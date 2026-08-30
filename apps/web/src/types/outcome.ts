import type { BaseSchema } from "./base";

/**
 * Outcome model
 */
export interface Outcome extends BaseSchema {
  challengeId: string; // Challenge ObjectId reference (unique)
  notes: string;
  hiddenNotes: string;
}
