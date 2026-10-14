import type { Challenge, TeacherDebrief } from "../types/challenge";
import type { Classroom } from "../types/classroom";
import type { Outcome } from "../types/outcome";
import type { ProfileType } from "../types/profileType";
import type { VariableDefinition } from "../types/variableDefinition";
import { formatMetricValue, sortMetricDefinitions } from "./formatMetric";
import { getChallengeResultState } from "./challengeStatus";

export interface ReportSection {
  title: string;
  paragraphs: string[];
}

// Deliberately contains no raw challenge, decisions, students, or rankings.
export interface ChallengeResultsReport {
  title: string;
  classroom: string;
  description: string;
  generatedAt: string;
  filename: string;
  outcomeNotes: string;
  instructorNotes: string;
  outcomeVariables: Array<[string, string]>;
  participation: Array<[string, string]>;
  profiles: Array<{
    label: string;
    count: string;
    metrics: Array<[string, string, string]>;
  }>;
  debrief: ReportSection[];
}

export function canDownloadChallengeResults(challenge: Challenge): boolean {
  const state = getChallengeResultState(challenge);
  return !!challenge.stats && challenge.isClosed &&
    !challenge.processingRun?.preparing &&
    !["queuedforprocessing", "processing"].includes(
      String(challenge.automationStatus).toLowerCase(),
    ) && (state === "awaitingFeedback" || state === "released");
}

const displayValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

function debriefSections(debrief?: TeacherDebrief): ReportSection[] {
  if (!debrief?.summary) {
    return [{ title: "Challenge debrief", paragraphs: [
      debrief?.status === "processing" ? "The instructor debrief is still being generated." :
      debrief?.status === "failed" ? "The instructor debrief could not be generated." :
      "No instructor debrief is available yet.",
    ] }];
  }
  const sections: ReportSection[] = [
    { title: "Challenge debrief", paragraphs: [debrief.summary] },
  ];
  const lists: Array<[string, string[] | undefined]> = [
    ["Patterns associated with stronger results", debrief.strongerPatterns],
    ["Patterns associated with weaker results", debrief.weakerPatterns],
    ["Expected variation", debrief.expectedVariation],
    ["Suspicious anomalies", debrief.suspiciousAnomalies],
    ["Common mistakes", debrief.commonMistakes],
    ["Suggested interventions", debrief.suggestedInterventions],
    ["Discussion questions", debrief.discussionQuestions],
  ];
  for (const [title, items] of lists) {
    if (items?.length) sections.push({ title, paragraphs: items.map(item => `• ${item}`) });
  }
  for (const profile of debrief.profileTypeSummaries ?? []) {
    sections.push({
      title: `${profile.label} - teaching summary`,
      paragraphs: [
        `${profile.participantCount} results. ${profile.summary}`,
        ...(profile.strengths ?? []).map(item => `Strength: ${item}`),
        ...(profile.risks ?? []).map(item => `Risk: ${item}`),
        ...(profile.recommendedFocus ?? []).map(item => `Recommended focus: ${item}`),
      ],
    });
  }
  return sections;
}

export function buildChallengeResultsReport({
  challenge, classroom, outcome, profileTypes, outcomeDefinitions, now = new Date(),
}: {
  challenge: Challenge;
  classroom: Classroom;
  outcome: Outcome | null;
  profileTypes: ProfileType[];
  outcomeDefinitions: VariableDefinition[];
  now?: Date;
}): ChallengeResultsReport {
  if (!canDownloadChallengeResults(challenge) || !challenge.stats) {
    throw new Error("Completed challenge statistics are not available.");
  }
  const stats = challenge.stats;
  let timeZone = classroom.automationSettings?.timezone || "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone }).format(now); }
  catch { timeZone = "UTC"; }
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => dateParts.find(p => p.type === type)?.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const title = challenge.title || "Challenge";
  const slug = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "challenge";
  const labels = new Map<string, string>();
  for (const profile of profileTypes) {
    labels.set(profile.key, profile.label);
    labels.set(profile._id, profile.label);
  }
  const metrics = sortMetricDefinitions(
    (stats.metricDefinitions ?? classroom.metricDefinitions ?? [])
      .filter(def => def.dataType === "number" && def.isActive !== false),
  );
  const definitions = new Map(outcomeDefinitions.map(def => [def.key, def]));
  const variableKeys = new Set([
    ...outcomeDefinitions.filter(def => def.isActive).map(def => def.key),
    ...Object.keys(outcome?.variables ?? {}),
  ]);
  return {
    title, classroom: classroom.name, description: challenge.description || "",
    generatedAt: new Intl.DateTimeFormat("en-US", {
      timeZone, dateStyle: "medium", timeStyle: "short",
    }).format(now) + ` (${timeZone})`,
    filename: `${slug}-results-${date}.pdf`,
    outcomeNotes: outcome?.notes?.trim() || "No outcome notes are available.",
    instructorNotes: outcome?.hiddenNotes?.trim() || "",
    outcomeVariables: [...variableKeys].map(key => [
      definitions.get(key)?.label || key, displayValue(outcome?.variables?.[key]),
    ]),
    participation: [
      ["Enrolled", displayValue(stats.totalEnrolled)],
      ["Submitted", displayValue(stats.submittedCount)],
      ["Missing", displayValue(stats.missingCount)],
    ],
    profiles: Object.entries(stats.storeTypeStats ?? {}).map(([key, profile]) => ({
      label: labels.get(key) || key,
      count: displayValue(profile.count),
      metrics: metrics.map(def => [def.label,
        formatMetricValue(profile.totals?.[def.key], def),
        formatMetricValue(profile.averages?.[def.key], def),
      ]),
    })),
    debrief: debriefSections(challenge.teacherDebrief),
  };
}
