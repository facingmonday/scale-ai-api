import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import classroomService from "@/services/classroom";
import type { AttentionCategory, ClassroomAttention } from "@/types/classroomAttention";

const categories: Array<{ key: AttentionCategory; label: string; icon: string }> = [
  { key: "submissions", label: "Missed submissions", icon: "pi-file-edit" },
  { key: "setup", label: "Profile setup", icon: "pi-user-edit" },
  { key: "access", label: "Seat review", icon: "pi-ticket" },
];
const PAGE_SIZE = 5;

interface NeedsAttentionProps {
  classroomId: string;
  refreshKey?: string | number;
}

export default function NeedsAttention({ classroomId, refreshKey }: NeedsAttentionProps) {
  const [report, setReport] = useState<ClassroomAttention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<AttentionCategory | "all">("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // Start on a microtask so loading changes are part of the asynchronous fetch.
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(false);
      try {
        const value = await classroomService.getAttention(classroomId, controller.signal);
        if (controller.signal.aborted) return;
        setReport(value);
        setPage(0);
      } catch {
        if (!controller.signal.aborted) {
          setReport(null);
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    });
    return () => controller.abort();
  }, [classroomId, refreshKey, refresh]);

  const students = report?.students.filter((student) => filter === "all" ||
    student.issues.some((issue) => issue.category === filter)) || [];
  const pageCount = Math.ceil(students.length / PAGE_SIZE);

  function selectFilter(value: AttentionCategory | "all") {
    setFilter(value);
    setPage(0);
  }

  return (
    <section className="card" aria-labelledby="needs-attention-heading" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="needs-attention-heading" className="heading-lg">Needs attention</h2>
          <p className="mt-1 text-sm text-text-secondary">Students who may need a check-in or help getting started.</p>
        </div>
        <button type="button" className="btn-outline" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>
          <i className={`pi ${loading ? "pi-spin pi-spinner" : "pi-refresh"} mr-2`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-sm text-text-secondary" role="status">Checking student participation and setup…</p>
      ) : error ? (
        <div className="mt-5 rounded-lg border border-ui-border p-4" role="alert">
          <p className="font-medium">Unable to check students right now.</p>
          <p className="mt-1 text-sm text-text-secondary">Refresh to try again.</p>
        </div>
      ) : report && (
        <>
          <div className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Filter students by attention category">
            {categories.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => selectFilter(filter === key ? "all" : key)}
                className={`flex items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors ${
                  filter === key ? "border-brand-teal bg-brand-teal/10" : "border-ui-border hover:bg-ui-surface-hover"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <i className={`pi ${icon} text-text-secondary`} aria-hidden="true" />{label}
                </span>
                <span className={`text-2xl font-semibold ${report.counts[key] ? "text-brand-orange" : "text-text-secondary"}`}>
                  {report.counts[key]}
                </span>
              </button>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-text-secondary" role="status">
              <span className="font-semibold text-text-primary">{students.length}</span> student{students.length === 1 ? "" : "s"}
              {filter === "all" ? " needing attention" : ` with ${categories.find((category) => category.key === filter)?.label.toLowerCase()}`}
              {report.totalEnrolled > 0 && ` · ${report.totalEnrolled} enrolled`}
            </p>
            {filter !== "all" && <button type="button" className="text-text-brand hover:underline" onClick={() => selectFilter("all")}>Show all</button>}
          </div>

          {students.length === 0 ? (
            <div className="rounded-lg border border-ui-border bg-ui-surface-hover/50 px-4 py-6">
              <p className="flex items-center gap-2 font-medium">
                <i className={`pi ${report.totalEnrolled ? "pi-check-circle text-brand-teal" : "pi-users text-text-secondary"}`} aria-hidden="true" />
                {report.totalEnrolled === 0 ? "No students enrolled yet" : filter === "all" ? "No students flagged by these checks" : "No students in this category"}
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                {report.totalEnrolled === 0 ? "Student follow-ups will appear here as your class gets started." : "Refresh after students submit work or finish setting up their profiles."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-ui-border border-y border-ui-border">
              {students.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((student) => (
                <li key={student.studentId} className="py-4">
                  <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Link to={student.href} className="font-semibold text-text-primary hover:text-text-brand hover:underline">{student.name}</Link>
                    {student.studentNumber && <span className="text-xs text-text-secondary">ID: {student.studentNumber}</span>}
                  </div>
                  <ul className="space-y-3">
                    {student.issues.filter((issue) => filter === "all" || issue.category === filter).map((issue) => (
                      <li key={issue.category} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{issue.title}</p>
                          <p className="mt-1 break-words text-sm text-text-secondary">{issue.detail}</p>
                        </div>
                        <Link to={issue.href} className="shrink-0 text-sm font-medium text-text-brand hover:underline" aria-label={`${issue.actionLabel} for ${student.name}`}>
                          {issue.actionLabel} <span aria-hidden="true">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {pageCount > 1 && (
            <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Students needing attention pages">
              <span className="text-text-secondary">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, students.length)} of {students.length} students</span>
              <div className="flex gap-2">
                <button type="button" className="btn-outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <button type="button" className="btn-outline" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </nav>
          )}
          <p className="mt-4 text-xs leading-relaxed text-text-secondary">
            Missed submissions means no student submission for at least 2 of the last 5 past-due challenges, counting only deadlines after joining.
            Automatic decisions do not count as student submissions. {report.recentChallengeCount === 0 && "No past-due challenges to check yet. "}
            Seat review flags recorded inactive seats; it does not confirm that access is blocked.
          </p>
        </>
      )}
    </section>
  );
}
