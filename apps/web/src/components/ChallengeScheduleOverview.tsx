import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import classroomService from "@/services/classroom";
import {
  calendarDay, calendarDays, calendarEvents, classroomTimezone,
  matchesScheduleFilter, shiftCalendarMonth,
} from "@/utils/challengeCalendar";
import type {
  CalendarEventKind, CalendarReminder, ChallengeScheduleFilter, ChallengeScheduleItem,
} from "@/utils/challengeCalendar";

const eventStyles: Record<CalendarEventKind, { label: string; dot: string; text: string }> = {
  opening: { label: "Opens", dot: "bg-brand-blue", text: "text-text-brand" },
  deadline: { label: "Due", dot: "bg-brand-orange", text: "challenge-calendar-deadline-text" },
  reminder: { label: "Reminder", dot: "bg-violet-500", text: "text-violet-700 dark:text-violet-300" },
  results: { label: "Results", dot: "challenge-calendar-results-dot", text: "challenge-calendar-results-text" },
};
const stats: Array<{ filter: ChallengeScheduleFilter; label: string; icon: string }> = [
  { filter: "open", label: "Open now", icon: "pi-play-circle" },
  { filter: "scheduled", label: "Scheduled", icon: "pi-calendar" },
  { filter: "drafts", label: "Drafts", icon: "pi-file-edit" },
  { filter: "review", label: "Needs review", icon: "pi-exclamation-circle" },
];
const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

interface Props {
  classroomId: string;
  timezone?: string;
  challenges: ChallengeScheduleItem[];
  loading: boolean;
  filter: ChallengeScheduleFilter;
  onFilter: (filter: ChallengeScheduleFilter) => void;
  onCreateWithAI: () => void;
  onCreateWithWizard: () => void;
  onRefresh: () => void;
}

export default function ChallengeScheduleOverview({
  classroomId, timezone: configuredTimezone, challenges, loading, filter,
  onFilter, onCreateWithAI, onCreateWithWizard, onRefresh,
}: Props) {
  const timezone = classroomTimezone(configuredTimezone);
  const [now, setNow] = useState(() => new Date());
  const today = calendarDay(now, timezone)!;
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [reminderState, setReminderState] = useState<"loading" | "ready" | "error">("loading");
  const [reminderRefresh, setReminderRefresh] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setReminderState("loading");
      try {
        const result = await classroomService.getCalendarReminders(classroomId, controller.signal);
        if (controller.signal.aborted) return;
        setReminders(result);
        setReminderState("ready");
      } catch {
        if (!controller.signal.aborted) {
          setReminders([]);
          setReminderState("error");
        }
      }
    });
    return () => controller.abort();
  }, [classroomId, challenges, reminderRefresh]);

  const events = useMemo(() => calendarEvents(challenges, reminders, timezone), [challenges, reminders, timezone]);
  const eventsByDay = useMemo(() => {
    const result = new Map<string, typeof events>();
    for (const event of events) {
      if (!result.has(event.day)) result.set(event.day, []);
      result.get(event.day)!.push(event);
    }
    return result;
  }, [events]);
  const days = calendarDays(month);
  const agenda = selectedDay ? eventsByDay.get(selectedDay) || [] : events.filter((event) => new Date(event.at) >= now);
  const displayedEvents = selectedDay ? agenda : agenda.slice(0, 5);
  const monthTitle = dayLabel(`${month}-01`, { month: "long", year: "numeric" });
  const time = (at: string) => new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(at));

  return (
    <div className="challenge-planning" aria-label="Challenge planning">
      <section className="card challenge-planning-panel" aria-labelledby="challenge-calendar-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="challenge-calendar-title" className="heading-md">Calendar</h2>
          <button type="button" className="text-sm font-medium text-text-brand hover:underline" onClick={() => {
            const day = calendarDay(new Date(), timezone)!;
            setMonth(day.slice(0, 7));
            setSelectedDay(day);
          }}>Today</button>
        </div>
        <div className="my-4 flex items-center justify-between gap-2">
          <button type="button" className="challenge-calendar-icon-button" aria-label="Previous month" onClick={() => setMonth(shiftCalendarMonth(month, -1))}>
            <i className="pi pi-chevron-left text-xs" aria-hidden="true" />
          </button>
          <p className="text-sm font-semibold" aria-live="polite">{monthTitle}</p>
          <button type="button" className="challenge-calendar-icon-button" aria-label="Next month" onClick={() => setMonth(shiftCalendarMonth(month, 1))}>
            <i className="pi pi-chevron-right text-xs" aria-hidden="true" />
          </button>
        </div>
        <div className="challenge-calendar-weekdays" aria-hidden="true">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day} className="py-1">{day}</span>)}
        </div>
        <div className="challenge-calendar-days" role="group" aria-label={`Days in ${monthTitle}`}>
          {days.map((day) => {
            const dayEvents = eventsByDay.get(day) || [];
            const kinds = [...new Set(dayEvents.map((event) => event.kind))];
            return (
              <button
                type="button" key={day} aria-pressed={selectedDay === day}
                aria-current={day === today ? "date" : undefined}
                aria-label={`${dayLabel(day, { dateStyle: "full" })}, ${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}`}
                onClick={() => { setSelectedDay(day); setMonth(day.slice(0, 7)); }}
                className={`challenge-calendar-day ${
                  selectedDay === day ? "border-brand-blue bg-brand-blue text-white" : day === today
                    ? "border-brand-teal bg-brand-teal/10 font-semibold text-text-primary" :
                    `border-transparent hover:bg-ui-muted ${day.startsWith(month) ? "text-text-primary" : "text-text-secondary opacity-60"}`
                }`}
              >
                <span>{Number(day.slice(-2))}</span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                  {kinds.map((kind) => <span key={kind} className={`challenge-calendar-event-dot ${selectedDay === day ? "bg-white" : eventStyles[kind].dot}`} />)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 border-t border-ui-border pt-4 text-xs text-text-secondary">
          {Object.entries(eventStyles).map(([kind, style]) => <span key={kind} className="inline-flex items-center gap-1.5"><span className={`challenge-calendar-legend-dot ${style.dot}`} aria-hidden="true" />{style.label}</span>)}
        </div>
        <p className="mt-3 break-words text-xs text-text-secondary">All times in {timezone.replaceAll("_", " ")}</p>
        {reminderState === "loading" && <p className="mt-2 text-xs text-text-secondary" role="status">Loading scheduled reminders…</p>}
        {reminderState === "error" && <p className="mt-2 text-xs text-text-secondary" role="alert">Reminders could not be loaded. <button type="button" className="font-medium text-text-brand underline" onClick={() => setReminderRefresh((value) => value + 1)}>Retry reminders</button></p>}
      </section>

      <section className="card challenge-planning-panel lg:col-span-2" aria-labelledby="challenge-overview-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="challenge-overview-title" className="heading-md">Challenge overview</h2>
            <p className="mt-1 text-sm text-text-secondary">{loading ? "Loading challenges…" : `${challenges.length} ${challenges.length === 1 ? "challenge" : "challenges"} in this classroom`}</p>
          </div>
          <button type="button" className="challenge-calendar-icon-button" aria-label="Refresh schedule" disabled={loading} onClick={() => {
            setNow(new Date());
            onRefresh();
          }}><i className={`pi ${loading ? "pi-spin pi-spinner" : "pi-refresh"}`} aria-hidden="true" /></button>
        </div>
        <div className="challenge-overview-stats">
          {stats.map((stat) => <button
            type="button" key={stat.filter} aria-pressed={filter === stat.filter} disabled={loading}
            onClick={() => onFilter(filter === stat.filter ? "all" : stat.filter)}
            className={`rounded-lg border p-3 text-left transition-colors ${filter === stat.filter ? "border-brand-teal bg-brand-teal/10" : "border-ui-border hover:bg-ui-muted"}`}
          >
            <span className="flex items-center gap-1.5 text-xs text-text-secondary"><i className={`pi ${stat.icon}`} aria-hidden="true" />{stat.label}</span>
            <span className="mt-2 block text-2xl font-semibold">{loading ? "—" : challenges.filter((challenge) => matchesScheduleFilter(challenge, stat.filter)).length}</span>
          </button>)}
        </div>
        <div className="my-4 flex flex-wrap gap-2">
          <Link to="/challenges/new" className="btn-teal inline-flex items-center gap-2"><i className="pi pi-plus" aria-hidden="true" />Create challenge</Link>
          <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={onCreateWithAI}><i className="pi pi-sparkles" aria-hidden="true" />Create with AI</button>
          <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={onCreateWithWizard}><i className="pi pi-bolt" aria-hidden="true" />Create with wizard</button>
          <Link to={`/classroom/${classroomId}?tab=automation`} className="btn-outline inline-flex items-center gap-2"><i className="pi pi-sliders-h" aria-hidden="true" />Schedule settings</Link>
        </div>
        <div className="border-t border-ui-border pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold" aria-live="polite">{selectedDay ? dayLabel(selectedDay, { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "Upcoming schedule"}</h3>
            {selectedDay && <button type="button" className="text-xs font-medium text-text-brand hover:underline" onClick={() => setSelectedDay(null)}>Show upcoming</button>}
          </div>
          {displayedEvents.length ? (
            <ul className="max-h-64 divide-y divide-ui-border overflow-y-auto pr-1">
              {displayedEvents.map((event) => <li key={event.id}>
                <Link to={`/challenges/${event.challengeId}`} className="flex items-center gap-3 rounded-md py-2.5 hover:bg-ui-muted">
                  <span className={`challenge-calendar-agenda-dot ${eventStyles[event.kind].dot}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" title={event.title}>{event.title}</span>
                    <span className={`text-xs ${eventStyles[event.kind].text}`}>{eventStyles[event.kind].label}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-text-secondary">
                    {!selectedDay && <span className="block">{dayLabel(event.day, { month: "short", day: "numeric" })}</span>}
                    <time dateTime={event.at}>{time(event.at)}</time>
                  </span>
                  <i className="pi pi-angle-right text-text-secondary" aria-hidden="true" />
                </Link>
              </li>)}
            </ul>
          ) : <p className="rounded-lg bg-ui-muted/50 px-3 py-5 text-sm text-text-secondary">{loading ? "Loading schedule…" : selectedDay ? "No events scheduled for this day." : "No upcoming events scheduled. Open a challenge to set its dates."}</p>}
          <p className="mt-3 text-xs text-text-secondary">
            {!selectedDay && agenda.length > 5 && `Showing the next 5 of ${agenda.length} events. `}
            Select a date to see its events. Open a challenge to adjust dates or reminders.
          </p>
        </div>
      </section>
    </div>
  );
}
