import { Component, useEffect, useState, type ReactNode } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import {
  getStudentActivity,
  type StudentActivityEvent,
  type StudentActivityPage,
} from "../services/studentActivity";

type ActivityProps = { classroomId: string; studentId?: string };

// Activity is optional: even a malformed record must not take down the
// dashboard or the teacher's student page.
class ActivityBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="card" aria-label="Student activity">
          <h2 className="heading-md">Activity log</h2>
          <p className="text-sm text-text-muted my-3" role="alert">Activity is temporarily unavailable.</p>
          <button type="button" className="btn-outline" onClick={() => this.setState({ failed: false })}>Retry activity</button>
        </section>
      );
    }
    return this.props.children;
  }
}

function SavedAnswers({ answers }: { answers: NonNullable<StudentActivityEvent["answers"]> }) {
  const groups = [
    { title: "Challenge answers", scope: "challenge", values: answers.challengeVariableAnswers },
    { title: "Decision variables", scope: "decision", values: answers.variables },
  ];
  const hasAnswers = groups.some((group) => Object.keys(group.values || {}).length > 0);
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-brand-blue">View saved answers</summary>
      {!hasAnswers && <p className="mt-2 text-text-muted">No answer details were recorded with this event.</p>}
      {groups.map((group) => Object.keys(group.values || {}).length > 0 && (
        <div className="mt-3" key={group.scope}>
          <h4 className="font-medium mb-2">{group.title}</h4>
          <dl className="divide-y divide-ui-border rounded-lg border border-ui-border px-3">
            {Object.entries(group.values || {}).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-text-secondary break-words">{answers.labels?.[`${group.scope}:${key}`] || key}</dt>
                <dd className="font-medium break-words sm:text-right">
                  {value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </details>
  );
}

function ActivityPanel({ classroomId, studentId }: ActivityProps) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: StudentActivityPage;
    error?: string;
  } | null>(null);
  const requestKey = `${classroomId}:${studentId || "me"}:${page}:${refresh}`;
  const current = result?.key === requestKey ? result : null;
  const loading = !current;

  useEffect(() => {
    const controller = new AbortController();
    getStudentActivity(classroomId, studentId, page * 10, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: "Activity is temporarily unavailable. Please try refreshing." });
      });
    return () => controller.abort();
  }, [classroomId, studentId, page, requestKey]);

  return (
    <section className="card" aria-label="Student activity" aria-busy={loading}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="heading-md flex items-center gap-2"><Clock3 className="size-5" aria-hidden />Activity log</h2>
          <p className="text-sm text-text-muted mt-1">Recorded submissions and calculation activity for this classroom.</p>
        </div>
        <button type="button" className="btn-outline" aria-label="Refresh activity" disabled={loading}
          onClick={() => { setPage(0); setRefresh((value) => value + 1); }}>
          <RefreshCw className="size-4" aria-hidden />
        </button>
      </div>
      <p className="text-xs text-text-muted mt-3">Older activity may not be recorded. Missing entries do not mean a submission was missed.</p>
      {loading && <p className="text-sm text-text-muted py-6" role="status">Loading activity…</p>}
      {current?.error && <p className="text-sm text-text-muted py-6" role="alert">{current.error}</p>}
      {current?.data && (
        <>
          {current.data.data.length === 0 ? (
            <p className="text-sm text-text-muted py-6">No recorded activity{page > 0 ? " on this page" : " yet"}.</p>
          ) : (
            <ol className="mt-4 divide-y divide-ui-border">
              {current.data.data.map((event) => (
                <li key={event.id} className="py-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                    <h3 className="text-sm font-semibold">{event.title}</h3>
                    <time dateTime={event.at} className="text-xs text-text-muted shrink-0">
                      {new Date(event.at).toLocaleString()}
                    </time>
                  </div>
                  <p className="text-sm text-text-secondary mt-1">{event.challengeTitle}</p>
                  {event.action === "processing_completed" && <p className="text-xs text-text-muted mt-1">Result availability follows the challenge’s release settings.</p>}
                  {event.answers && <SavedAnswers answers={event.answers} />}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {(page > 0 || current?.data?.hasMore) && (
        <nav className="flex items-center justify-between gap-3 pt-3 border-t border-ui-border" aria-label="Activity pages">
          <button type="button" className="btn-outline" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Newer</button>
          <span className="text-xs text-text-muted">Page {page + 1}</span>
          <button type="button" className="btn-outline" disabled={!current?.data?.hasMore || loading} onClick={() => setPage((value) => value + 1)}>Older</button>
        </nav>
      )}
    </section>
  );
}

export default function StudentActivity(props: ActivityProps) {
  return (
    <ActivityBoundary key={`${props.classroomId}:${props.studentId || "me"}`}>
      <ActivityPanel {...props} />
    </ActivityBoundary>
  );
}
