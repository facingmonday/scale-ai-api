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
}

/**
 * Classroom with virtual/computed fields
 */
export interface ClassroomWithVirtuals extends Classroom {
  enrollmentCount?: number; // Virtual: count of enrollments
}
