import type { BaseSchema } from "./base";

/**
 * Notification type
 */
export type NotificationType = "email" | "sms" | "push" | "web";

/**
 * Notification status
 */
export type NotificationStatus =
  | "Pending"
  | "Sent"
  | "Skipped"
  | "Failed"
  | "Read"
  | "Deleted"
  | "Unread";

/**
 * Recipient type
 */
export type RecipientType = "User" | "Member" | "Admin" | "Guest";

/**
 * NotificationRecipient model
 */
export interface NotificationRecipient {
  id?: string; // ObjectId reference
  type: RecipientType;
  ref: string; // Model name (e.g., "Member", "Organization")
}

/**
 * NotificationMetadata model
 */
export interface NotificationMetadata {
  emailSent: boolean;
  emailQueued: boolean;
  emailSkipped: boolean;
  emailSkipReason?: string;
  emailError?: string;
  smsSent: boolean;
  smsQueued: boolean;
  smsError?: string;
  pushSent: boolean;
  pushQueued: boolean;
  pushError?: string;
}

/**
 * Notification model
 */
export interface Notification extends BaseSchema {
  type: NotificationType;
  recipient: NotificationRecipient;
  sender?: string;
  title: string;
  message: string;
  templateSlug?: string;
  html?: string;
  text?: string;
  templateData?: Record<string, any>;
  modelData?: Record<string, any>; // IDs for template population
  status: NotificationStatus;
  metadata: NotificationMetadata;
}

/**
 * Notification with virtual/computed fields
 */
export interface NotificationWithVirtuals extends Notification {
  id: string; // Virtual: _id as hex string
}
