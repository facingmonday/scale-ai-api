export type ChallengeScheduleValues = {
  publishAt?: string;
  publishMode?: "MANUAL" | "SCHEDULED";
  submissionDeadlineAt?: string;
  closeSubmissionsAt?: string;
  processAt?: string;
  feedbackReleaseAt?: string;
  feedbackReleaseMode?: "IMMEDIATE" | "DELAYED" | "MANUAL";
  allowLateSubmissions?: boolean;
  lateSubmissionPolicy?: {
    penaltyPercentPerDay: number;
  };
  automationMode?: "MANUAL" | "FULL";
  missingSubmissionPolicy?: "FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP";
  punishAbsentStudents?: "high" | "medium" | "low" | "none";
};
