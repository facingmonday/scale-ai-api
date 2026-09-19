export type GradeMode = "AUTOMATIC" | "POINTS" | "EXCUSED";
export interface GradeChange {
  revision: number;
  mode?: GradeMode;
  points?: number | null;
  excluded?: boolean;
  reason: string;
  actor: string;
  at: string;
}
export interface GradeHistory {
  revision: number;
  changes: GradeChange[];
  nextBefore: number | null;
}
export interface GradeColumn {
  id: string;
  title: string;
  week: number;
  pointsPossible: number | null;
  policyVersion: number | null;
  includedAt: string | null;
  dueAt: string | null;
  excluded: boolean;
  exclusionRevision: number;
  exclusionReason: string;
}
export interface GradeCell {
  challengeId: string;
  pointsPossible: number | null;
  automaticPoints: number | null;
  effectivePoints: number | null;
  status: string;
  reasonCode: string;
  generationMethod: string | null;
  includedInTotal: boolean;
  policyVersion: number | null;
  decisionId: string | null;
  studentSubmittedAt: string | null;
  enrollmentDateUnknown: boolean;
  revision: number;
  adjustment: {
    mode: GradeMode;
    points: number | null;
    reason: string;
    actor: string;
    at: string;
  } | null;
}
export interface GradeRow {
  userId: string;
  firstName: string;
  lastName: string;
  name: string;
  studentNumber: string;
  isRemoved: boolean;
  joinedAt: string | null;
  removedAt: string | null;
  cells: GradeCell[];
  totals: {
    earnedPoints: number;
    possiblePoints: number;
    percentage: number | null;
  };
}
export interface Gradebook {
  classroomId: string;
  evaluatedAt: string;
  defaultChallengePoints: number;
  columns: GradeColumn[];
  rows: GradeRow[];
  totalStudents: number;
  page: number;
  limit: number;
}
export interface GradeFilters {
  search: string;
  sort: "name" | "earned" | "percentage";
  direction: "asc" | "desc";
  includeRemoved: boolean;
  challengeIds: string[];
  page: number;
  limit: number;
}
