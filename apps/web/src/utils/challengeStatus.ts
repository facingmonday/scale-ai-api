export type ChallengeLifecycleStatus =
  | "Draft"
  | "Scheduled"
  | "Open"
  | "Locked"
  | "Closed";
export type ChallengePresentationStatus =
  | ChallengeLifecycleStatus
  | "Calculating Results"
  | "Completed"
  | "Results Ready";

export interface ChallengeLifecycleInput {
  isPublished?: boolean;
  isLockedForStudents?: boolean;
  isClosed?: boolean;
  lifecycleStatus?: ChallengeLifecycleStatus;
  automationStatus?: string;
  automatedProcessedAt?: string | Date | null;
  isFeedbackReleased?: boolean;
  processingRun?: {
    preparing?: boolean;
  };
  automationMode?: string;
  publishMode?: "MANUAL" | "SCHEDULED";
  publishAt?: string | Date | null;
}

export type ChallengeResultState =
  | "idle"
  | "calculating"
  | "awaitingFeedback"
  | "released";

export interface ChallengePresentationOptions {
  audience?: "teacher" | "student";
  decisionProcessingStatus?: string;
  hasLedger?: boolean;
  jobStatuses?: string[];
}

const CALCULATING_AUTOMATION_STATUSES = new Set([
  "queuedforprocessing",
  "processing",
]);

const COMPLETED_AUTOMATION_STATUSES = new Set([
  "completed",
  "processed",
  "feedbackreleased",
]);

export function getChallengeResultState(
  challenge: ChallengeLifecycleInput | null | undefined,
): ChallengeResultState {
  if (!challenge) return "idle";

  const automationStatus = String(
    challenge.automationStatus || "",
  ).toLowerCase();

  if (
    challenge.isFeedbackReleased ||
    automationStatus === "feedbackreleased"
  ) {
    return "released";
  }

  if (
    challenge.processingRun?.preparing ||
    CALCULATING_AUTOMATION_STATUSES.has(automationStatus)
  ) {
    return "calculating";
  }

  if (
    COMPLETED_AUTOMATION_STATUSES.has(automationStatus) ||
    !!challenge.automatedProcessedAt
  ) {
    return "awaitingFeedback";
  }

  return "idle";
}

export function getChallengeLifecycleStatus(
  challenge: ChallengeLifecycleInput | null | undefined,
): ChallengeLifecycleStatus {
  if (!challenge) return "Draft";
  if (challenge.lifecycleStatus) return challenge.lifecycleStatus;
  if (challenge.isClosed) return "Closed";
  const publishAt = challenge.publishAt
    ? new Date(challenge.publishAt).getTime()
    : null;
  const resolvedPublishMode =
    challenge.publishMode || (challenge.publishAt ? "SCHEDULED" : "MANUAL");
  const hasScheduledStart =
    resolvedPublishMode === "SCHEDULED" &&
    publishAt !== null &&
    !Number.isNaN(publishAt);
  const waitingForPublishWorker =
    !challenge.isPublished && hasScheduledStart;
  const startsInFuture = publishAt !== null && publishAt > Date.now();
  if (hasScheduledStart && (startsInFuture || waitingForPublishWorker)) {
    return "Scheduled";
  }
  if (!challenge.isPublished) return "Draft";
  if (challenge.isLockedForStudents) return "Locked";
  return "Open";
}

export function getChallengeLifecycleBadgeClass(
  status: ChallengeLifecycleStatus,
): string {
  switch (status) {
    case "Draft":
      return "badge-warning";
    case "Scheduled":
      return "badge-info";
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

export function getChallengePresentationStatus(
  challenge: ChallengeLifecycleInput | null | undefined,
  options: ChallengePresentationOptions = {},
): ChallengePresentationStatus {
  if (!challenge) return "Draft";

  const automationStatus = String(challenge.automationStatus || "").toLowerCase();
  const decisionStatus = String(
    options.decisionProcessingStatus || "",
  ).toLowerCase();
  const jobStatuses = options.jobStatuses?.map((status) =>
    String(status).toLowerCase(),
  ) ?? [];
  const hasNonTerminalJob = jobStatuses.some((status) =>
    status === "pending" || status === "running",
  );
  const decisionIsCalculating =
    decisionStatus === "pending" || decisionStatus === "processing";

  if (
    options.audience === "student" &&
    decisionStatus === "completed" &&
    options.hasLedger
  ) {
    return "Results Ready";
  }

  if (
    hasNonTerminalJob ||
    (options.audience === "student" &&
      decisionIsCalculating &&
      (!!challenge.isClosed || !!challenge.isLockedForStudents)) ||
    (CALCULATING_AUTOMATION_STATUSES.has(automationStatus) &&
      (options.audience !== "student" || !!decisionStatus))
  ) {
    return "Calculating Results";
  }

  if (COMPLETED_AUTOMATION_STATUSES.has(automationStatus)) {
    if (options.audience === "student" && !decisionStatus) {
      return getChallengeLifecycleStatus(challenge);
    }
    return "Completed";
  }

  return getChallengeLifecycleStatus(challenge);
}

export function getChallengePresentationBadgeClass(
  status: ChallengePresentationStatus,
): string {
  if (status === "Calculating Results") return "badge-info";
  if (status === "Completed" || status === "Results Ready") {
    return "badge-success";
  }
  return getChallengeLifecycleBadgeClass(status);
}

export function isChallengeLockedForStudents(
  challenge: ChallengeLifecycleInput | null | undefined,
): boolean {
  if (!challenge) return false;
  const status = getChallengeLifecycleStatus(challenge);
  return (
    status === "Scheduled" || status === "Locked" || status === "Closed"
  );
}
