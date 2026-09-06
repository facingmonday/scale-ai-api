export type ChallengeEmailAudience = "all" | "missing";
export interface ChallengeEmailPreview {
  subject: string;
  templateSlug: string;
  templateData: {
    challenge: { title: string };
    classroom: { name: string };
    deadline: string | null;
    timezone: string;
    link: string;
  };
  recipientCount: number;
  unavailable: string | null;
  deliveryDisabled: boolean;
  suppressed: boolean;
}
export interface ChallengeEmailRun {
  _id: string;
  kind: "manual" | "scheduled";
  audience: ChallengeEmailAudience;
  sendAt: string;
  timezone: string;
  status:
    | "scheduled"
    | "pending"
    | "dispatching"
    | "dispatched"
    | "skipped"
    | "cancelled"
    | "failed";
  error?: string;
  recipientCount: number | null;
  counts: {
    queued: number;
    sent: number;
    skipped: number;
    failed: number;
    pending: number;
  };
}
export interface ChallengeEmailHistory {
  timezone: string;
  runs: ChallengeEmailRun[];
}
