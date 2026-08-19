import type { BaseSchema } from "./base";

export interface PopulatedUser {
  _id: string;
  firstName?: string;
  lastName?: string;
}

export interface PopulatedClassroom {
  _id: string;
  name: string;
  description?: string;
}

export interface PopulatedScenario {
  _id: string;
  title: string;
  description?: string;
}

export interface PopulatedSubmission {
  _id: string;
  submittedAt?: Date | string;
}

/**
 * SimulationJob status
 */
export type JobStatus = "pending" | "running" | "completed" | "failed";

/**
 * SimulationJob model
 */
export interface SimulationJob extends BaseSchema {
  id?: string; // optional virtual
  classroomId: string | PopulatedClassroom; // Classroom ObjectId reference or populated object
  challengeId: string | PopulatedScenario; // Challenge ObjectId reference or populated object
  decisionId?: string | PopulatedSubmission | null; // Decision ObjectId reference or populated object
  userId: string | PopulatedUser; // Member ObjectId reference or populated object
  status: JobStatus;
  attempts: number; // min: 0
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  dryRun: boolean; // Default: false
  /** Exact hardened request persisted for OpenAI Batch processing. */
  openaiRequest?: Record<string, unknown> | null;
  /** Prompt messages before platform-policy hardening. */
  openaiRequestRawMessages?: Array<Record<string, unknown>> | null;
  openaiRequestPreparedAt?: Date | string | null;
}

/**
 * CronJob worker type
 */
export type WorkerType = "ticket-reminder" | "email-digest" | "cart-cleanup";

/**
 * CronJob model
 */
export interface CronJob {
  _id: string; // MongoDB ObjectId
  jobName: string;
  description?: string;
  workerType: WorkerType;
  schedule: string; // Cron expression (5 parts: minute hour day month dow)
  timezone: string; // Default: "America/Chicago"
  enabled: boolean; // Default: true
  organization?: string; // Organization ObjectId reference (required if not system job)
  isSystemJob: boolean; // Default: false

  // Execution tracking
  lastRun?: Date;
  nextRun?: Date;
  runCount: number; // Default: 0
  successCount: number; // Default: 0
  errorCount: number; // Default: 0
  lastSuccess?: Date;
  lastError?: Date;
  lastErrorMessage?: string;

  // Metadata
  metadata: Record<string, unknown>;

  // Lease fields (for distributed locking)
  leaseOwner?: string | null;
  leaseExpiresAt?: Date | null;

  // Base schema fields (manually added)
  createdBy: string; // Clerk user ID
  createdDate?: Date;
  updatedBy: string; // Clerk user ID
  updatedDate?: Date;
}

/**
 * CronJob with virtual/computed fields
 */
export interface CronJobWithVirtuals extends CronJob {
  id: string; // Virtual: _id as hex string
}
