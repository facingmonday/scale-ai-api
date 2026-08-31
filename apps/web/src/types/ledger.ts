import type { BaseSchema } from "./base";
import type { MetricDefinition } from "./metric";

/**
 * AI metadata for ledger entries
 */
export interface AIMetadata {
  model: string;
  runId: string;
  generatedAt: Date;
}

export type StudentFeedbackImpact =
  | "positive"
  | "negative"
  | "mixed"
  | "neutral";

export interface StudentFeedbackDriver {
  title: string;
  explanation: string;
  impact: StudentFeedbackImpact;
  source:
    | "decision"
    | "outcome"
    | "profile"
    | "prior_result"
    | "random_event"
    | "result";
}

export interface StudentNextAction {
  title: string;
  rationale: string;
}

export interface StudentExplanationValue {
  key: string;
  label: string;
  description?: string;
  value: unknown;
  dataType?: string;
  format?: string | null;
}

export interface StudentResultExplanation {
  overview: string;
  keyDrivers: StudentFeedbackDriver[];
  nextActions: StudentNextAction[];
  guidanceStatus: "completed" | "failed" | "unavailable";
  details: {
    startingState: StudentExplanationValue[];
    profileConstraints: StudentExplanationValue[];
    challengeContext: StudentExplanationValue[];
    decisions: StudentExplanationValue[];
    publicOutcome: {
      notes: string;
      values: StudentExplanationValue[];
    };
    randomEvent?: string | null;
    finalMetrics: StudentExplanationValue[];
    deterministicCalculations: Array<{
      key: string;
      label: string;
      expression: string;
      values: Record<string, number>;
    }>;
  };
  modeledOutcomeNotice: string;
}

export interface StudentFeedback {
  status: "completed" | "failed";
  keyDrivers: StudentFeedbackDriver[];
  nextActions: StudentNextAction[];
  generatedAt?: Date | string | null;
  model?: string | null;
  error?: string | null;
}

/**
 * Calculation context for auditability (matches backend API)
 */
export interface CalculationContext {
  profileVariables?: Record<string, unknown>;
  challengeVariables?: Record<string, unknown>;
  decisionVariables?: Record<string, unknown>;
  outcomeVariables?: Record<string, unknown>;

  priorMetrics?: Record<string, unknown>;
  ledgerHistorySummary?: Array<{
    _id?: string;
    challengeId: string | null;
    challengeTitle: string;
    metrics: Record<string, unknown>;
  }>;

  prompt?: string | null;
}

/**
 * Variable definition shape returned alongside ledger details
 */
export interface LedgerVariableDefinition {
  key: string;
  label: string;
  description: string;
  dataType: "number" | "string" | "boolean" | "select";
  inputType: string;
}

/**
 * Calculation details response from API
 */
export interface CalculationDetails {
  ledgerEntry: LedgerEntry;
  calculationContext: CalculationContext;
  variableDefinitions: {
    profile: LedgerVariableDefinition[];
    challenge: LedgerVariableDefinition[];
    decision: LedgerVariableDefinition[];
    outcome: LedgerVariableDefinition[];
  };
  metricDefinitions: MetricDefinition[];
}

/**
 * Ledger entry adjustment / audit trail
 */
export interface LedgerAdjustment {
  _id: string;
  ledgerEntryId: string;
  adjustedBy: string;
  adjustedAt: Date;
  reason: string;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  originalEntry?: LedgerEntry;
}

/**
 * LedgerEntry model — dynamic metrics shape.
 * All output values live in `metrics` keyed by MetricDefinition.key.
 */
export interface LedgerEntry extends BaseSchema {
  profileId: string;
  classroomId: string;
  challengeId: string;
  userId: string;
  decisionId?: string;

  /** Dynamic metrics keyed by MetricDefinition.key */
  metrics: Record<string, unknown>;

  randomEvent?: string | null;
  summary: string;

  aiMetadata?: AIMetadata;

  studentFeedback?: StudentFeedback;
  resultExplanation?: StudentResultExplanation;

  overridden: boolean;
  overriddenBy?: string | null;
  overriddenAt?: Date | null;

  calculationContext?: CalculationContext;

  adjustments?: LedgerAdjustment[];
}
