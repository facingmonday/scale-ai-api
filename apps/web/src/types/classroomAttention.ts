export type AttentionCategory = "submissions" | "setup" | "access";

export interface ClassroomAttention {
  checkedAt: string;
  totalEnrolled: number;
  recentChallengeCount: number;
  counts: Record<AttentionCategory | "all", number>;
  students: Array<{
    studentId: string;
    name: string;
    studentNumber: string;
    href: string;
    missedCount: number;
    issues: Array<{
      category: AttentionCategory;
      title: string;
      detail: string;
      actionLabel: string;
      href: string;
    }>;
  }>;
}
