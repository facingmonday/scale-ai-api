import type { BaseSchema } from "./base";
import type { MemberWithVirtuals } from "./member";
import type { VariableDefinition } from "./variableDefinition";
import type { MetricDefinition } from "./metric";
import type { BillingMode, JoinPolicy } from "./licensing";

export type ClassroomPromptRole = "system" | "user" | "assistant" | "developer";

export interface ClassroomPrompt {
  role: ClassroomPromptRole;
  content: string;
}

export interface ClassroomAutomationSettings {
  enabled: boolean;
  timezone: string;
  defaultReleaseDay: string;
  defaultReleaseTime: string;
  defaultDueDay: string;
  defaultDueTime: string;
  defaultCloseDelayHours: number;
  defaultProcessDelayHours: number;
  defaultFeedbackReleaseMode: "IMMEDIATE" | "DELAYED" | "MANUAL";
  missingSubmissionPolicy: "FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP";
}

/**
 * Classroom model
 */
export interface Classroom extends BaseSchema {
  name: string;
  description: string;
  isActive: boolean;
  adminIds: string[]; // Array of Clerk user IDs
  ownership: MemberWithVirtuals;
  variableDefinitions: {
    challenge: VariableDefinition[];
    decision: VariableDefinition[];
    profile: VariableDefinition[];
    profileType?: VariableDefinition[];
    outcome?: VariableDefinition[];
  };
  metricDefinitions?: MetricDefinition[];
  role: "admin" | "member";
  imageUrl?: string;
  billingMode?: BillingMode;
  joinPolicy?: JoinPolicy;
  studentPaysAllowed?: boolean;
  allowedDomains?: string[];
  accessCode?: string;
  allowAnonymousJoin?: boolean;
  /**
   * Optional prompt stack used by the simulation engine.
   * Present when reading/updating an existing classroom.
   */
  prompts?: ClassroomPrompt[];
  automationSettings?: ClassroomAutomationSettings;
}

/**
 * Classroom with virtual/computed fields
 */
export interface ClassroomWithVirtuals extends Classroom {
  enrollmentCount?: number; // Virtual: count of enrollments
}

export interface AutomationTask extends BaseSchema {
  classroomId: string;
  name: string;
  trigger: "AFTER_CHALLENGE_CREATED" | "AFTER_STUDENT_SUBMISSION" | "AFTER_CHALLENGE_CLOSED" | "AFTER_CHALLENGE_CLOSED_PER_STUDENT";
  promptTemplate: string;
  isActive: boolean;
  actionType: "GENERATE_SLIDES" | "GENERATE_REPORT" | "SEND_NOTIFICATION" | "CUSTOM_PROMPT";
  config: Record<string, any>;
}

