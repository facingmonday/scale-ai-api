import type { BaseSchema } from "./base";

/**
 * ProfileType model
 */
export interface ProfileType extends BaseSchema {
  key: string;
  label: string;
  description: string;
  isActive: boolean;
  /**
   * Starting cash balance for a new student profile created with this profile type.
   * Backend default: 0.
   */
  startingBalance?: number;
  /**
   * One-time initial cost applied when a student creates a profile of this type.
   * Backend default: 0.
   */
  initialStartupCost?: number;
  variables?: Record<string, unknown>;
}

/**
 * ProfileType with populated variables (returned from API GET)
 */
export interface StoreTypeWithVariables extends ProfileType {
  variables?: Record<string, unknown>;
}
