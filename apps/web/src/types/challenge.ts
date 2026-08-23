import type { BaseSchema } from "./base";
import type { Decision } from "./decision";
import type { LedgerEntry } from "./ledger";
import type { SubmissionPopulatedUser } from "./decision";
import type { Profile } from "./profile";

/**
 * Backend uses a profile-type key (e.g. "indoor", "outdoor", "food_truck") for stats grouping.
 */
export type StoreTypeKey = string;

export interface TeacherDebrief {
  summary?: string;
  status: "pending" | "processing" | "completed" | "failed";
  generatedAt?: string | null;
  attempts?: number;
  error?: string | null;
}

export type ChallengeLifecycleStatus =
  | "Draft"
  | "Scheduled"
  | "Open"
  | "Locked"
  | "Closed";

/**
 * Challenge model
 */
export interface Challenge extends BaseSchema {
  id: string;
  classroomId: string; // Classroom ObjectId reference
  title: string;
  description: string;
  imageUrl?: string;
  isPublished: boolean;
  isClosed: boolean;
  isLockedForStudents?: boolean;
  lifecycleStatus?: ChallengeLifecycleStatus;
  publishAt?: string | Date | null;
  publishMode?: "MANUAL" | "SCHEDULED";
  submissionDeadlineAt?: string | Date | null;
  closeSubmissionsAt?: string | Date | null;
  processAt?: string | Date | null;
  feedbackReleaseAt?: string | Date | null;
  feedbackReleaseMode?: "IMMEDIATE" | "DELAYED" | "MANUAL";
  isFeedbackReleased?: boolean;
  allowLateSubmissions?: boolean;
  lateSubmissionPolicy?: {
    penaltyPercentPerDay: number;
  };
  automationMode?: "MANUAL" | "FULL";
  automationStatus?: string;
  automationError?: string | null;
  automationLastCheckedAt?: string | Date | null;
  automatedProcessedAt?: string | Date | null;
  missingSubmissionPolicy?: "FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP";
  punishAbsentStudents?: "high" | "medium" | "low" | "none";
  decision?: Decision;
  ledgerEntry?: LedgerEntry;
  variables?: Record<string, unknown>; // Object where keys match variable definition keys and values are the challenge variable values
  stats?: ScenarioStats;
  teacherDebrief?: TeacherDebrief;
}

/**
 * Challenge with populated variables (returned from API)
 */
export interface ScenarioWithVariables extends Challenge {
  variables: Record<string, unknown>;
}

/**
 * ScenarioVariableValue model
 */
export interface ScenarioVariableValue extends BaseSchema {
  challengeId: string; // Challenge ObjectId reference
  variableKey: string;
  value: string | number | boolean | object; // Mixed type
}

/**
 * Job information in stats decision
 */
export interface StatsSubmissionJob {
  _id: string;
  status: string;
  attempts: number;
  error: string | null;
  startedAt: string;
  completedAt: string;
  dryRun: boolean;
}

/**
 * Decision in challenge stats (with populated fields)
 */
export interface StatsSubmission {
  _id: string;
  classroomId: string;
  challengeId: string;
  userId: SubmissionPopulatedUser;
  submittedAt: string;
  ledgerEntryId: LedgerEntry;
  jobs: StatsSubmissionJob[];
  processingStatus: string;
  organization: string;
  createdBy: string;
  updatedBy: string;
  createdDate: string;
  updatedDate: string;
  variables: Record<string, unknown>;
  __v: number;
  profile: Profile;
}

/**
 * Dynamic metric totals/averages for profile type stats.
 * Keys correspond to MetricDefinition.key entries with dataType "number".
 */
export type StoreTypeMetricTotals = Record<string, number>;

/**
 * Winner/loser entry in profile type stats
 */
export interface StoreTypeWinnerLoser {
  decisionId: string;
  userId: SubmissionPopulatedUser;
  profile: {
    _id: string;
    shopName: string;
    profileType: StoreTypeKey;
  };
  metrics: Record<string, number>;
  primaryMetricKey: string;
  primaryMetricValue: number;
}

/**
 * Statistics for a specific profile type
 */
export interface StoreTypeStat {
  profileType: StoreTypeKey;
  count: number;
  totals: StoreTypeMetricTotals;
  averages: StoreTypeMetricTotals;
  winners: StoreTypeWinnerLoser[];
  losers: StoreTypeWinnerLoser[];
}

/**
 * Missing decision user info
 */
export interface MissingSubmissionUser {
  _id: string;
  clerkUserId: string;
  firstName: string;
  lastName: string;
  maskedEmail: string;
  email: string;
}

/**
 * Challenge statistics object
 */
export interface ScenarioStats {
  decisions: StatsSubmission[];
  storeTypeStats: Record<StoreTypeKey, StoreTypeStat>;
  metricDefinitions?: import("./metric").MetricDefinition[];
  totalEnrolled: number;
  submittedCount: number;
  missingCount: number;
  missingSubmissions: MissingSubmissionUser[];
}
