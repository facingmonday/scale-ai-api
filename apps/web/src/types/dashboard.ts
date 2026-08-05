import type { ScenarioWithVariables } from "./challenge";
import type { Profile } from "./profile";

/**
 * Class Dashboard Response
 */

interface DashboardBase {
  className: string;
  classDescription: string;
}
export interface LeaderboardMetric {
  key: string;
  label: string;
  format: import("./metric").MetricFormat;
}

export interface LeaderboardEntry {
  _id?: string;
  userId: string;
  profileId: string;
  profileName: string;
  metricTotal: number;
  studentId?: string;
}

export interface AdminDashboardResponse extends DashboardBase {
  isActive: boolean;
  students: number;
  activeScenario: ScenarioWithVariables | null;
  submissionsCompleted: number;
  leaderboardTop10: LeaderboardEntry[];
  leaderboardMetric: LeaderboardMetric | null;
  pendingApprovals: number;
}

/**
 * Student Dashboard Response
 *
 * This reflects the data the Student Dashboard page needs:
 * - Profile summary (for StoreHeader)
 * - Current challenge + decision status (for CurrentScenarioCard)
 */
export interface StudentDashboardResponse extends DashboardBase {
  profile: Profile | null;
  currentScenario: ScenarioWithVariables | null;
  submissionStatus: { submitted: boolean; submittedAt: string | null } | null;
}

/**
 * Backwards-compatible alias (older code referenced this name).
 */
export type ClassDashboard = AdminDashboardResponse;

/**
 * Roster Entry
 */
export interface RosterEntry {
  enrollmentId: string;
  userId: string;
  clerkUserId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: "admin" | "member";
  joinedAt: Date;
}
