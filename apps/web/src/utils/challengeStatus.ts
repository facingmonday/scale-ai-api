export type ChallengeLifecycleStatus = "Draft" | "Open" | "Locked" | "Closed";

export interface ChallengeLifecycleInput {
  isPublished?: boolean;
  isLockedForStudents?: boolean;
  isClosed?: boolean;
  lifecycleStatus?: ChallengeLifecycleStatus;
}

export function getChallengeLifecycleStatus(
  challenge: ChallengeLifecycleInput | null | undefined,
): ChallengeLifecycleStatus {
  if (!challenge) return "Draft";
  if (challenge.lifecycleStatus) return challenge.lifecycleStatus;
  if (!challenge.isPublished) return "Draft";
  if (challenge.isClosed) return "Closed";
  if (challenge.isLockedForStudents) return "Locked";
  return "Open";
}

export function getChallengeLifecycleBadgeClass(
  status: ChallengeLifecycleStatus,
): string {
  switch (status) {
    case "Draft":
      return "badge-warning";
    case "Open":
      return "badge-success";
    case "Locked":
      return "bg-ui-muted text-text-secondary";
    case "Closed":
      return "badge-danger";
    default:
      return "badge-muted";
  }
}

export function isChallengeLockedForStudents(
  challenge: ChallengeLifecycleInput | null | undefined,
): boolean {
  if (!challenge) return false;
  const status = getChallengeLifecycleStatus(challenge);
  return status === "Locked" || status === "Closed";
}
