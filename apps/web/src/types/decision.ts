import type { BaseSchema } from "./base";
import type { LedgerEntry } from "./ledger";
import type { VariableDefinition } from "./variableDefinition";
import type { Profile } from "./profile";

/**
 * Variable definition with value (used in decisions)
 */
export type VariableDefinitionWithValue = VariableDefinition & {
  value: string | number | boolean | object;
};

/**
 * Populated user data in decision response
 */
export interface SubmissionPopulatedUser {
  _id: string;
  clerkUserId: string;
  firstName: string;
  lastName: string;
  maskedEmail?: string;
}

/**
 * Decision model
 */
export interface Decision extends BaseSchema {
  classroomId: string; // Classroom ObjectId reference
  challengeId: string; // Challenge ObjectId reference
  userId: string | SubmissionPopulatedUser; // Member ObjectId reference or populated object
  submittedAt: Date;
  variables?: Record<string, unknown>; // Object where keys match variable definition keys and values are the decision values
  ledgerEntry?: LedgerEntry;
  profile?: Profile; // Populated profile data
  processingStatus: "pending" | "processing" | "completed" | "failed";
  generation?: {
    method: "MANUAL" | "AI" | "FORWARDED_PREVIOUS" | "AI_FALLBACK" | "DEFAULTS";
    forwardedFromScenarioId: string | null;
    forwardedFromSubmissionId: string | Decision | null;
    meta: Record<string, unknown> | null;
  };
}

/**
 * Decision with populated variables (returned from API)
 */
export interface SubmissionWithVariables extends Decision {
  variables: Record<string, unknown>;
}

/**
 * SubmissionVariableValue model
 */
export interface SubmissionVariableValue extends BaseSchema {
  decisionId: string; // Decision ObjectId reference
  variableKey: string;
  value: string | number | boolean | object; // Mixed type
}

/**
 * Member data in decision response
 */
export interface SubmissionMember {
  _id: string;
  clerkUserId: string;
  firstName: string;
  lastName: string;
  maskedEmail: string;
}

/**
 * Decision with populated member data (from getSubmissionsForScenario)
 */
export interface SubmissionWithMember {
  _id: string;
  member: SubmissionMember;
  variables: Record<string, unknown>; // Object where keys match variable definition keys and values are the decision values
  submittedAt: Date | string;
}

/**
 * Response from getSubmissionsForScenario
 */
export interface SubmissionsForScenarioResponse {
  success: boolean;
  data: {
    decisions: SubmissionWithMember[];
    missingSubmissions?: SubmissionMember[];
    totalEnrolled: number;
    submittedCount: number;
    missingCount: number;
  };
}
