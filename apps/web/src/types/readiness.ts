export type ReadinessOperation = "preview" | "process" | "rerun";
export type ReadinessStatus = "ready" | "warning" | "blocked";

export interface ClassroomReadinessAction {
  label: string;
  href: string;
}

export interface ClassroomReadinessCheck {
  key: string;
  severity: "blocker" | "warning";
  status: "pass" | "fail" | "skipped";
  title: string;
  message: string;
  action?: ClassroomReadinessAction;
}

export interface ClassroomReadiness {
  status: ReadinessStatus;
  blockers: number;
  warnings: number;
  passed: number;
  classroomId: string;
  challengeId: string | null;
  operation: ReadinessOperation;
  checkedAt: string;
  checks: ClassroomReadinessCheck[];
}
