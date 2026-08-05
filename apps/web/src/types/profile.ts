import type { BaseSchema } from "./base";
import type { LedgerEntry } from "./ledger";
import type { ProfileType } from "./profileType";

/**
 * Profile model
 */
export interface Profile extends BaseSchema {
  imageUrl?: string;
  classroomId: string; // Classroom ObjectId reference
  userId: string; // Member ObjectId reference
  /**
   * Student identifier (string) displayed alongside profile details.
   */
  studentId: string;
  shopName: string;
  profileType: ProfileType;
  storeDescription?: string;
  storeLocation?: string;
  variables?: Record<string, unknown>; // Object where keys match variable definition keys and values are the profile variable values
  /**
   * Optional: some endpoints include ledger entries inline for convenience.
   */
  ledgerEntries?: LedgerEntry[];
  currentDetails?: {
    cashBalance: number | null;
    inventory: number | null;
    totalRevenue: number | null;
    totalCosts: number | null;
    totalNetProfit: number | null;
    totalSales: number | null;
    totalWaste: number | null;
    scenarioCount: number | null;
    totalEntries: number | null;
  };
}

/**
 * Profile with populated variables (returned from API)
 */
export interface StoreWithVariables extends Profile {
  variables: Record<string, unknown>;
}

/**
 * StoreVariableValue model
 */
export interface StoreVariableValue extends BaseSchema {
  profileId: string; // Profile ObjectId reference
  variableKey: string;
  value: string | number | boolean | object; // Mixed type - can be number, string, boolean, etc.
}
