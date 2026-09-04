/**
 * Create Classroom Request
 */
export interface CreateClassroomRequest {
  name: string;
  description?: string;
  templateId?: string;
}

/**
 * Create Profile Request
 */
export interface CreateStoreRequest {
  classroomId: string;
  studentId: string;
  shopName: string;
  profileType: string;
  storeDescription?: string;
  storeLocation?: string;
  imageUrl?: string;
  variables?: Record<string, unknown>;
}

/**
 * Create Variable Definition Request
 */
export interface CreateVariableDefinitionRequest {
  classroomId: string;
  key: string;
  label: string;
  description?: string;
  appliesTo: "profile" | "challenge" | "decision";
  dataType: "number" | "string" | "boolean" | "select";
  inputType?: "text" | "number" | "slider" | "dropdown" | "checkbox";
  options?: string[];
  defaultValue?: unknown;
  min?: number;
  max?: number;
  required?: boolean;
}

/**
 * Create Challenge Request
 */
export interface CreateScenarioRequest {
  simulationMode?: "direct" | "batch";
  simulationConcurrency?: number;
  classroomId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  variables?: Record<string, unknown>;
  publishAt?: string | null;
  publishMode?: "MANUAL" | "SCHEDULED";
  submissionDeadlineAt?: string | null;
  closeSubmissionsAt?: string | null;
  processAt?: string | null;
  feedbackReleaseAt?: string | null;
  feedbackReleaseMode?: "IMMEDIATE" | "DELAYED" | "MANUAL";
  allowLateSubmissions?: boolean;
  lateSubmissionPolicy?: {
    penaltyPercentPerDay: number;
  };
  automationMode?: "MANUAL" | "FULL";
  missingSubmissionPolicy?: "FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP";
  punishAbsentStudents?: "high" | "medium" | "low" | "none";
}

/**
 * Create a complete challenge from instructor-provided source text.
 */
export interface CreateScenarioWithAIRequest {
  classroomId: string;
  prompt: string;
  timeZone?: string;
}

/**
 * Set Challenge Outcome Request
 */
export interface SetScenarioOutcomeRequest {
  notes?: string;
  hiddenNotes?: string;
}

/**
 * Create Decision Request
 */
export interface CreateSubmissionRequest {
  challengeId: string;
  variables: Record<string, string | number | boolean>;
}

/**
 * Override Ledger Entry Request
 * Patch any subset of dynamic metrics, plus optional summary/randomEvent.
 */
export interface OverrideLedgerEntryRequest {
  metrics?: Record<string, unknown>;
  randomEvent?: string;
  summary?: string;
  reason?: string; // Reason for the adjustment (for audit trail)
}

/**
 * Process Pending Jobs Request
 */
export interface ProcessPendingJobsRequest {
  limit?: number; // Default: 10
}
