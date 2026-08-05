import type { BaseSchema } from "./base";
import type { Classroom } from "./classroom";

/**
 * Enrollment model
 */
export interface Enrollment extends BaseSchema {
  classroomId: Classroom; // Classroom ObjectId reference
  userId: string; // Member ObjectId reference
  role: "admin" | "member";
  joinedAt: Date;
  isRemoved: boolean; // Soft delete flag
  removedAt: Date | null;
}
