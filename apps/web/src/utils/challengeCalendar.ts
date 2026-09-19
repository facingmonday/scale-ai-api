import { getChallengeLifecycleStatus, getChallengeResultState } from "./challengeStatus";
import type { ChallengeLifecycleInput } from "./challengeStatus";

export interface ChallengeScheduleItem extends ChallengeLifecycleInput {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  createdDate?: string | Date;
  createdAt?: string | Date;
  submissionDeadlineAt?: string | Date | null;
  closeSubmissionsAt?: string | Date | null;
  processAt?: string | Date | null;
  feedbackReleaseAt?: string | Date | null;
  feedbackReleaseMode?: "IMMEDIATE" | "DELAYED" | "MANUAL";
  automationError?: string | null;
}

export interface CalendarReminder {
  _id: string;
  challengeId: string;
  sendAt: string;
}

export type CalendarEventKind = "opening" | "deadline" | "reminder" | "results";
export type ChallengeScheduleFilter = "all" | "open" | "scheduled" | "drafts" | "review";
export interface ChallengeCalendarEvent {
  id: string;
  challengeId: string;
  title: string;
  kind: CalendarEventKind;
  at: string;
  day: string;
}

export function classroomTimezone(timezone?: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone || "America/Chicago" }).format();
    return timezone || "America/Chicago";
  } catch {
    return "America/Chicago";
  }
}

export function calendarDay(value: string | Date, timezone: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Date-only arithmetic uses UTC to avoid the browser timezone and DST shifts.
export function shiftCalendarMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + amount, 1)).toISOString().slice(0, 7);
}

export function calendarDays(month: string) {
  const [year, value] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, value - 1, 1));
  return Array.from({ length: 42 }, (_, index) =>
    new Date(Date.UTC(year, value - 1, 1 - first.getUTCDay() + index)).toISOString().slice(0, 10));
}

export function calendarEvents(challenges: ChallengeScheduleItem[], reminders: CalendarReminder[], timezone: string) {
  const events: ChallengeCalendarEvent[] = [];
  const byId = new Map(challenges.map((challenge) => [challenge._id || challenge.id, challenge]));
  function add(challenge: ChallengeScheduleItem, kind: CalendarEventKind, value?: string | Date | null, suffix = "") {
    const challengeId = challenge._id || challenge.id;
    if (!value || !challengeId) return;
    const day = calendarDay(value, timezone);
    if (!day) return;
    events.push({
      id: `${challengeId}:${kind}${suffix}`, challengeId,
      title: challenge.title || challenge.name || "Untitled challenge",
      kind, at: new Date(value).toISOString(), day,
    });
  }
  for (const challenge of challenges) {
    if (challenge.publishMode === "SCHEDULED" || (!challenge.publishMode && challenge.publishAt)) {
      add(challenge, "opening", challenge.publishAt);
    }
    add(challenge, "deadline", challenge.submissionDeadlineAt || challenge.closeSubmissionsAt);
    if (challenge.feedbackReleaseMode !== "MANUAL" && challenge.feedbackReleaseMode !== "IMMEDIATE") {
      add(challenge, "results", challenge.feedbackReleaseAt);
    }
  }
  for (const reminder of reminders) {
    const challenge = byId.get(reminder.challengeId);
    if (challenge) add(challenge, "reminder", reminder.sendAt, `:${reminder._id}`);
  }
  return events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

export function matchesScheduleFilter(challenge: ChallengeScheduleItem, filter: ChallengeScheduleFilter) {
  if (filter === "all") return true;
  const status = getChallengeLifecycleStatus(challenge);
  if (filter === "review") return ["BLOCKED", "FAILED"].includes((challenge.automationStatus || "").toUpperCase()) ||
    getChallengeResultState(challenge) === "awaitingFeedback";
  return status === ({ open: "Open", scheduled: "Scheduled", drafts: "Draft" } as const)[filter];
}
