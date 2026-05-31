/**
 * Base schema that all models extend
 */
export interface BaseSchema {
  _id: string; // MongoDB ObjectId as string
  organization: string; // Organization ObjectId reference
  createdBy: string; // Clerk user ID
  createdDate: Date;
  updatedBy: string; // Clerk user ID
  updatedDate: Date;
}

/**
 * Common utility types
 */
export type ObjectId = string; // MongoDB ObjectId represented as string
export type ClerkUserId = string; // Clerk user identifier
export type ISODateString = string; // ISO 8601 date string
