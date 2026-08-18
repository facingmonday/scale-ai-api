import type { ScenarioWithVariables } from "./challenge";
import type { Profile } from "./profile";
import type { MetricDefinition } from "./metric";

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
  metricDefinitionCount: number;
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
  activeScenario: ScenarioWithVariables | null;
  decision: unknown | null;
  submissionStatus: { submitted: boolean; submittedAt: string | null } | null;
  metricDefinitions: MetricDefinition[];
  latestResult: StudentDashboardResult | null;
  recentResults: StudentDashboardResult[];
  completedChallengeCount: number;
  classStatistics: StudentClassStatistics | null;
}

export interface StudentDashboardResult {
  challengeId: string;
  title: string;
  week: number;
  completedAt?: string | Date;
  metrics: Record<string, unknown>;
  summary: string;
  randomEvent?: string | null;
  outcomeNotes?: string;
}

export interface StudentClassStatistics {
  challengeId: string;
  title: string;
  participantCount: number;
  rank: number | null;
  averages: Record<string, number>;
  studentMetrics: Record<string, unknown>;
  leaderboardMetric: LeaderboardMetric | null;
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
