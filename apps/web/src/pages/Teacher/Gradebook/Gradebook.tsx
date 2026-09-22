import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "primereact/dialog";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import GradingDefaultSettings from "../../../components/GradingDefaultSettings";
import { useAuth } from "../../../context/AuthContext";
import gradebookService from "../../../services/gradebook";
import { getErrorMessage } from "../../../utils";
import type {
  Gradebook as GradebookData,
  GradeCell,
  GradeColumn,
  GradeFilters,
  GradeHistory,
  GradeMode,
  GradeRow,
} from "../../../types/gradebook";

const labels: Record<string, string> = {
  COMPLETED: "Completed",
  AUTOMATED: "Automated",
  MISSING: "Missing",
  PENDING: "Pending",
  EXCUSED: "Excused",
  NOT_APPLICABLE: "Not applicable",
  UNGRADED: "Ungraded",
  UPCOMING: "Upcoming",
  ADJUSTED: "Adjusted",
  EXCLUDED: "Excluded",
};
const explanations: Record<string, string> = {
  NO_GRADING_POLICY:
    "This challenge was created before grading was introduced and does not count toward totals.",
  NOT_OPEN: "This challenge has not opened yet.",
  STUDENT_SUBMISSION: "Student-submitted work earns full completion points.",
  LEGACY_STUDENT_SUBMISSION:
    "Legacy student submission; detailed provenance was not recorded.",
  OUTSIDE_ENROLLMENT:
    "This assignment falls outside this student's enrollment dates.",
  AUTOMATED_SUBMISSION:
    "An automated decision is present, but no student submission has been recorded.",
  SKIPPED:
    "No student submission was recorded; the missing-submission policy skips processing.",
  NO_SUBMISSION: "No student submission was recorded by the deadline.",
  AWAITING_SUBMISSION:
    "Awaiting student submission. This work is not yet counted.",
  TEACHER_POINTS: "A teacher assigned this score.",
  TEACHER_EXCUSED: "This student is excused from the assignment.",
  CHALLENGE_EXCLUDED: "This challenge is excluded from everyone's totals.",
};
const number = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const initialFilters: GradeFilters = {
  search: "",
  sort: "name",
  direction: "asc",
  includeRemoved: false,
  challengeIds: [],
  page: 1,
  limit: 50,
};

function GradeDialog({
  classroomId,
  column,
  row,
  cell,
  onClose,
  onSaved,
}: {
  classroomId: string;
  column: GradeColumn;
  row?: GradeRow;
  cell?: GradeCell;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<GradeMode>(
    cell?.adjustment?.mode || "POINTS",
  );
  const [points, setPoints] = useState(String(cell?.effectivePoints ?? 0));
  const [excluded, setExcluded] = useState(column.excluded);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<GradeHistory | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const validTarget =
    column.pointsPossible !== null && (!cell || cell.status !== "UPCOMING");
  useEffect(() => {
    const abort = new AbortController();
    gradebookService
      .history(classroomId, column.id, row?.userId, undefined, abort.signal)
      .then(setHistory)
      .catch((e) => {
        if (!abort.signal.aborted) setError(getErrorMessage(e));
      });
    return () => abort.abort();
  }, [classroomId, column.id, row?.userId]);
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (row && cell)
        await gradebookService.adjust(classroomId, column.id, row.userId, {
          mode,
          ...(mode === "POINTS" ? { points: Number(points) } : {}),
          reason: reason.trim(),
          expectedRevision: cell.revision,
        });
      else
        await gradebookService.exclude(classroomId, column.id, {
          excluded,
          reason: reason.trim(),
          expectedRevision: column.exclusionRevision,
        });
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const moreHistory = async () => {
    if (!history?.nextBefore) return;
    setHistoryLoading(true);
    try {
      const next = await gradebookService.history(
        classroomId,
        column.id,
        row?.userId,
        history.nextBefore,
      );
      setHistory({ ...next, changes: [...history.changes, ...next.changes] });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setHistoryLoading(false);
    }
  };
  return (
    <Dialog
      visible
      onHide={() => {
        if (!saving) onClose();
      }}
      header={row ? `${row.name} · ${column.title}` : column.title}
      modal
      className="modal w-full max-w-2xl"
      maskClassName="modal-mask"
      headerClassName="modal-header"
      contentClassName="modal-content"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={onSaved}
            disabled={saving}
          >
            Close and refresh
          </button>
          {validTarget && (
            <button
              type="button"
              className="btn-teal"
              disabled={
                saving ||
                !reason.trim() ||
                (!!cell && mode === "POINTS" && points === "")
              }
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-text-muted">
          Maximum: {number(column.pointsPossible)} points.{" "}
          {column.pointsPossible !== null
            ? "Frozen when this challenge was created."
            : "Existing work is ungraded this semester."}
        </p>
        {cell && (
          <>
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 text-sm">
              <dt>Automatic points</dt>
              <dd>{number(cell.automaticPoints)}</dd>
              <dt>Effective points</dt>
              <dd>{number(cell.effectivePoints)}</dd>
              <dt>Status</dt>
              <dd>{labels[cell.status] || cell.status}</dd>
              <dt>Submission provenance</dt>
              <dd>{cell.generationMethod || "No submission"}</dd>
              <dt>Student submission time</dt>
              <dd>Unknown</dd>
              <dt>Counts in current grade</dt>
              <dd>{cell.includedInTotal ? "Yes" : "No"}</dd>
            </dl>
            <p className="text-sm">{explanations[cell.reasonCode]}</p>
            {cell.enrollmentDateUnknown && (
              <p className="text-sm text-text-muted">
                Enrollment date is unknown; no exemption was inferred.
              </p>
            )}
            {cell.decisionId && (
              <Link
                className="text-sm text-text-brand underline"
                to={`/decisions/${cell.decisionId}`}
              >
                View submission
              </Link>
            )}
          </>
        )}
        {column.excluded && (
          <p className="text-sm text-text-muted">
            Challenge exclusion: {column.exclusionReason}
          </p>
        )}
        {validTarget && (
          <div className="space-y-3 border-t border-border pt-4">
            {cell ? (
              <>
                <label className="label" htmlFor="grade-mode">
                  Grading action
                </label>
                <select
                  id="grade-mode"
                  className="input"
                  value={mode}
                  disabled={saving}
                  onChange={(e) => setMode(e.target.value as GradeMode)}
                >
                  <option value="POINTS">Assign points</option>
                  <option value="EXCUSED">Excuse this assignment</option>
                  <option value="AUTOMATIC">Restore automatic grading</option>
                </select>
                {mode === "POINTS" && (
                  <>
                    <label className="label" htmlFor="grade-points">
                      Points (0–{number(column.pointsPossible)})
                    </label>
                    <input
                      id="grade-points"
                      type="number"
                      className="input"
                      min="0"
                      max={column.pointsPossible ?? undefined}
                      step="0.01"
                      value={points}
                      disabled={saving}
                      onChange={(e) => setPoints(e.target.value)}
                    />
                  </>
                )}
              </>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={excluded}
                  disabled={saving}
                  onChange={(e) => setExcluded(e.target.checked)}
                />
                Exclude this challenge from all student totals
              </label>
            )}
            <label className="label" htmlFor="grade-reason">
              Reason (required)
            </label>
            <textarea
              id="grade-reason"
              className="input min-h-24"
              value={reason}
              maxLength={2000}
              disabled={saving}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        <section className="border-t border-border pt-4">
          <h3 className="font-medium">Adjustment history</h3>
          {!history ? (
            <p className="mt-2 text-sm text-text-muted">Loading history…</p>
          ) : !history.changes.length ? (
            <p className="mt-2 text-sm text-text-muted">
              No teacher adjustments.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {history.changes.map((change) => (
                <li
                  key={change.revision}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="font-medium">
                    {change.mode === "POINTS"
                      ? `${number(change.points ?? null)} points`
                      : change.mode === "EXCUSED"
                        ? "Excused"
                        : change.mode === "AUTOMATIC"
                          ? "Automatic grading restored"
                          : change.excluded
                            ? "Challenge excluded"
                            : "Challenge restored"}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{change.reason}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(change.at).toLocaleString()} · {change.actor} ·
                    Revision {change.revision}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {history?.nextBefore && (
            <button
              type="button"
              className="btn-outline mt-3"
              disabled={historyLoading}
              onClick={() => void moreHistory()}
            >
              Older changes
            </button>
          )}
        </section>
      </div>
    </Dialog>
  );
}

function ClassroomGradebook({ classroomId }: { classroomId: string }) {
  const [filters, setFilters] = useState<GradeFilters>(initialFilters);
  const [data, setData] = useState<GradebookData | null>(null);
  const [allColumns, setAllColumns] = useState<GradeColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [layout, setLayout] = useState<"gradebook" | "detailed">("gradebook");
  const [exporting, setExporting] = useState(false);
  const exportAbort = useRef<AbortController | null>(null);
  const [selection, setSelection] = useState<{
    column: GradeColumn;
    row?: GradeRow;
    cell?: GradeCell;
  } | null>(null);
  useEffect(() => () => exportAbort.current?.abort(), []);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      gradebookService
        .get(classroomId, filters, abort.signal)
        .then((value) => {
          if (abort.signal.aborted) return;
          setData(value);
          if (!filters.challengeIds.length) setAllColumns(value.columns);
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(getErrorMessage(e));
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [classroomId, filters, refresh]);
  const changeFilters = (next: Partial<GradeFilters>) =>
    setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  const download = async () => {
    setExporting(true);
    setError("");
    const abort = new AbortController();
    exportAbort.current = abort;
    try {
      const blob = await gradebookService.export(
        classroomId,
        filters,
        layout,
        abort.signal,
      );
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `gradebook-${layout}-${classroomId}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!abort.signal.aborted) setError(getErrorMessage(e));
    } finally {
      if (!abort.signal.aborted) setExporting(false);
    }
  };
  const pages = Math.max(
    1,
    Math.ceil((data?.totalStudents || 0) / filters.limit),
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="heading-xl">Gradebook</h1>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
              Preview
            </span>
          </div>
          <p className="mt-2 text-sm text-text-muted">
            Completion points for new challenges. Visible only to teachers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={() => setRefresh((n) => n + 1)}
            disabled={loading}
          >
            Refresh
          </button>
          <select
            className="input w-auto"
            aria-label="CSV layout"
            value={layout}
            onChange={(e) => setLayout(e.target.value as typeof layout)}
          >
            <option value="gradebook">Gradebook CSV</option>
            <option value="detailed">Detailed scores CSV</option>
          </select>
          <button
            type="button"
            className="btn-teal"
            disabled={exporting || !data}
            onClick={() => void download()}
          >
            {exporting ? "Exporting…" : "Download CSV"}
          </button>
        </div>
      </div>
      <GradingDefaultSettings classroomId={classroomId} />
      <div className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <label htmlFor="grade-search" className="label">
              Find student
            </label>
            <input
              id="grade-search"
              className="input"
              placeholder="Name or student number"
              value={filters.search}
              onChange={(e) => changeFilters({ search: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="grade-challenge" className="label">
              Challenge
            </label>
            <select
              id="grade-challenge"
              className="input max-w-64"
              value={filters.challengeIds[0] || ""}
              onChange={(e) =>
                changeFilters({
                  challengeIds: e.target.value ? [e.target.value] : [],
                })
              }
            >
              <option value="">All challenges</option>
              {allColumns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.week}. {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="grade-sort" className="label">
              Sort by
            </label>
            <select
              id="grade-sort"
              className="input"
              value={filters.sort}
              onChange={(e) =>
                changeFilters({ sort: e.target.value as GradeFilters["sort"] })
              }
            >
              <option value="name">Student name</option>
              <option value="earned">Earned points</option>
              <option value="percentage">Current grade</option>
            </select>
          </div>
          <select
            className="input w-auto"
            aria-label="Sort direction"
            value={filters.direction}
            onChange={(e) =>
              changeFilters({
                direction: e.target.value as GradeFilters["direction"],
              })
            }
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <label className="flex items-center gap-2 py-2 text-sm">
            <input
              type="checkbox"
              checked={filters.includeRemoved}
              onChange={(e) =>
                changeFilters({ includeRemoved: e.target.checked })
              }
            />
            Include removed students
          </label>
        </div>
        <p className="text-xs text-text-muted">
          Current grade excludes pending, excused, not-applicable, and ungraded
          work. Totals and exports follow the selected challenge filter.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 p-3 text-sm text-red-500"
        >
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm">
          <span>
            {data?.totalStudents ?? "—"} students ·{" "}
            {data?.columns.length ?? "—"} challenges
          </span>
          <span role="status" className="text-text-muted">
            {loading
              ? "Loading grades…"
              : data
                ? `Updated ${new Date(data.evaluatedAt).toLocaleTimeString()}`
                : ""}
          </span>
        </div>
        <div className="max-h-[65vh] overflow-auto" aria-busy={loading}>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Student completion points by challenge
            </caption>
            <thead className="sticky top-0 z-20 bg-card">
              <tr className="border-b border-border text-left">
                <th
                  scope="col"
                  className="sticky left-0 z-30 min-w-56 bg-card p-4"
                >
                  Student
                </th>
                {data?.columns.map((column) => (
                  <th
                    scope="col"
                    key={column.id}
                    className="min-w-36 max-w-56 p-3 align-top"
                  >
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => setSelection({ column })}
                    >
                      <span className="block font-medium">
                        {column.week}. {column.title}
                      </span>
                      <span className="mt-1 block text-xs font-normal text-text-muted">
                        {column.pointsPossible === null
                          ? "Ungraded"
                          : `${number(column.pointsPossible)} points · fixed`}
                        {column.excluded ? " · Excluded" : ""}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="min-w-36 p-4">
                  Earned / possible
                </th>
                <th scope="col" className="min-w-32 p-4">
                  Current grade
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row) => (
                <tr
                  key={row.userId}
                  className="border-b border-border last:border-0"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-card p-4 text-left font-normal"
                  >
                    <Link
                      to={`/students/${row.userId}?classroomId=${encodeURIComponent(classroomId)}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span className="mt-1 block text-xs text-text-muted">
                      {row.studentNumber || "No student number"}
                      {row.isRemoved ? " · Removed" : ""}
                    </span>
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={cell.challengeId} className="p-2">
                      <button
                        type="button"
                        className="w-full rounded-lg border border-transparent px-3 py-2 text-left hover:border-border hover:bg-muted focus-visible:outline-2"
                        onClick={() =>
                          setSelection({
                            row,
                            cell,
                            column: data.columns[index],
                          })
                        }
                        aria-label={`${row.name}, ${data.columns[index].title}: ${cell.effectivePoints === null ? labels[cell.status] : `${cell.effectivePoints} points`}`}
                      >
                        <span
                          className={
                            cell.effectivePoints === null
                              ? "text-text-muted"
                              : "font-semibold tabular-nums"
                          }
                        >
                          {cell.effectivePoints === null
                            ? labels[cell.status] || cell.status
                            : number(cell.effectivePoints)}
                        </span>
                        {cell.effectivePoints !== null && (
                          <span className="mt-1 block text-xs text-text-muted">
                            {cell.reasonCode === "SKIPPED"
                              ? "Skipped"
                              : labels[cell.status]}
                          </span>
                        )}
                      </button>
                    </td>
                  ))}
                  <td className="p-4 font-medium tabular-nums">
                    {number(row.totals.earnedPoints)} /{" "}
                    {number(row.totals.possiblePoints)}
                  </td>
                  <td className="p-4 font-semibold tabular-nums">
                    {row.totals.percentage === null
                      ? "—"
                      : `${number(row.totals.percentage)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !data?.rows.length && (
            <p className="p-8 text-center text-text-muted">
              {error
                ? "Unable to load grades."
                : "No students match these filters."}
            </p>
          )}
        </div>
        {!loading &&
          data &&
          !data.columns.some((c) => c.pointsPossible !== null) && (
            <p className="border-t border-border p-4 text-sm text-text-muted">
              Grading will appear automatically for challenges created after
              this release. Existing challenges remain ungraded.
            </p>
          )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3 text-sm">
          <span>
            Page {filters.page} of {pages}
          </span>
          <div className="flex items-center gap-2">
            <select
              className="input w-auto"
              aria-label="Students per page"
              value={filters.limit}
              onChange={(e) => changeFilters({ limit: Number(e.target.value) })}
            >
              <option value={25}>25 students</option>
              <option value={50}>50 students</option>
              <option value={100}>100 students</option>
            </select>
            <button
              type="button"
              className="btn-outline"
              disabled={loading || filters.page <= 1}
              onClick={() => changeFilters({ page: filters.page - 1 })}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={loading || filters.page >= pages}
              onClick={() => changeFilters({ page: filters.page + 1 })}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        CSV exports include every matching student. When importing into a
        spreadsheet, set student identifiers to text to preserve leading zeros.
      </p>
      {selection && (
        <GradeDialog
          classroomId={classroomId}
          {...selection}
          onClose={() => setSelection(null)}
          onSaved={() => {
            setSelection(null);
            setRefresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

export default function Gradebook() {
  const { activeClassroom } = useAuth();
  return (
    <BasicLayout constrainWidth>
      <div className="page">
        <div className="container">
          {activeClassroom?._id ? (
            <ClassroomGradebook
              key={activeClassroom._id}
              classroomId={activeClassroom._id}
            />
          ) : (
            <p className="card">Select a classroom to view its gradebook.</p>
          )}
        </div>
      </div>
    </BasicLayout>
  );
}
