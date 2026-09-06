import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import service from "../services/challengeEmail";
import type {
  ChallengeEmailAudience,
  ChallengeEmailHistory,
  ChallengeEmailPreview,
} from "../types/challengeEmail";
import { getErrorMessage } from "../utils";

function localValue(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}
export default function ChallengeEmails({
  challengeId,
}: {
  challengeId: string;
}) {
  const [history, setHistory] = useState<ChallengeEmailHistory>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<ChallengeEmailAudience>("missing");
  const [preview, setPreview] = useState<ChallengeEmailPreview>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [localTime, setLocalTime] = useState("");
  const [editing, setEditing] = useState<string>();
  const sendKey = useRef(crypto.randomUUID());
  const scheduleKey = useRef(crypto.randomUUID());
  const refresh = useCallback(async () => {
    setHistory(await service.list(challengeId));
  }, [challengeId]);
  useEffect(() => {
    let active = true;
    void service
      .list(challengeId)
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((e) => {
        if (active) setError(getErrorMessage(e));
      });
    const timer = window.setInterval(() => {
      void refresh().catch(() => {});
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [challengeId, refresh]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void service
      .preview(challengeId, audience)
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch((e) => {
        if (active) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [challengeId, audience, open]);
  async function act(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      await refresh();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const timezone = history?.timezone || "America/Chicago";
  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  return (
    <section
      className="card mt-4 mb-4"
      aria-labelledby="challenge-emails-title"
    >
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <div>
          <h2 id="challenge-emails-title" className="heading-md">
            Email students
          </h2>
          <p className="text-text-muted text-sm">
            Send a challenge announcement or remind students who have not
            submitted their decisions.
          </p>
        </div>
        <button
          type="button"
          className="btn-teal"
          disabled={busy}
          onClick={() => {
            setError("");
            setPreview(undefined);
            setPreviewLoading(true);
            setOpen(true);
          }}
        >
          Send email
        </button>
      </div>
      {error && (
        <p role="alert" className="text-red-500 my-3">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm my-3">
          {notice}
        </p>
      )}
      <div className="mt-5 border-t border-current/10 pt-4">
        <h3 className="font-semibold">Automatic reminders</h3>
        <p className="text-text-muted text-sm mb-3">
          Only students with missing decisions receive reminders. Times use{" "}
          {timezone}. Reminders are checked every five minutes.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            Reminder date and time ({timezone})
            <input
              type="datetime-local"
              className="input"
              value={localTime}
              disabled={busy || !history}
              onChange={(e) => {
                setLocalTime(e.target.value);
                scheduleKey.current = crypto.randomUUID();
              }}
            />
          </label>
          <button
            type="button"
            className="btn-teal"
            disabled={busy || !localTime || !history}
            onClick={() =>
              void act(
                async () => {
                  await service.schedule(
                    challengeId,
                    localTime,
                    scheduleKey.current,
                    editing,
                  );
                  setLocalTime("");
                  setEditing(undefined);
                  scheduleKey.current = crypto.randomUUID();
                },
                editing ? "Reminder updated." : "Reminder scheduled.",
              )
            }
          >
            {editing ? "Save reminder" : "Add reminder"}
          </button>
          {editing && (
            <button
              type="button"
              className="btn-outline"
              disabled={busy}
              onClick={() => {
                setEditing(undefined);
                setLocalTime("");
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {history?.runs
            .filter((r) => r.status === "scheduled")
            .map((run) => (
              <div
                key={run._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-current/10 p-3"
              >
                <span>
                  {formatTime(run.sendAt)} · {timezone}
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={busy}
                    onClick={() => {
                      setEditing(run._id);
                      setLocalTime(localValue(run.sendAt, timezone));
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await service.cancel(challengeId, run._id);
                        if (editing === run._id) {
                          setEditing(undefined);
                          setLocalTime("");
                        }
                      }, "Reminder cancelled.")
                    }
                  >
                    Cancel reminder
                  </button>
                </div>
              </div>
            ))}
          {history && !history.runs.some((r) => r.status === "scheduled") && (
            <p className="text-text-muted text-sm">No upcoming reminders.</p>
          )}
        </div>
      </div>
      <div className="mt-5">
        <h3 className="font-semibold mb-2">Send history</h3>
        {!history && (
          <p className="text-text-muted text-sm">Loading email history…</p>
        )}
        {history && !history.runs.some((r) => r.status !== "scheduled") && (
          <p className="text-text-muted text-sm">
            No emails sent from this panel yet.
          </p>
        )}
        <div className="space-y-2">
          {history?.runs
            .filter((r) => r.status !== "scheduled")
            .map((run) => (
              <div
                key={run._id}
                className="rounded border border-current/10 p-3 text-sm"
              >
                <p className="font-medium">
                  {run.audience === "all"
                    ? "All enrolled students"
                    : "Students with missing decisions"}{" "}
                  · {run.kind === "manual" ? "Manual" : "Scheduled"}
                </p>
                <p>
                  {formatTime(run.sendAt)} · {timezone} ·{" "}
                  {run.status === "dispatched"
                    ? "Dispatch complete"
                    : run.status}
                </p>
                <p className="text-text-muted">
                  {run.counts.queued} queued · {run.counts.sent} sent ·{" "}
                  {run.counts.skipped} skipped · {run.counts.failed} failed
                  {run.counts.pending > 0
                    ? ` · ${run.counts.pending} pending`
                    : ""}
                </p>
                {run.recipientCount === 0 && <p>No eligible recipients.</p>}
                {run.error && <p className="text-red-500">{run.error}</p>}
              </div>
            ))}
        </div>
      </div>
      <Dialog
        header="Send challenge email"
        visible={open}
        onHide={() => {
          if (!busy) setOpen(false);
        }}
        style={{ width: "min(640px, 95vw)" }}
        modal
        closable={!busy}
      >
        <label className="flex flex-col gap-2">
          Audience
          <select
            className="input"
            value={audience}
            disabled={busy}
            onChange={(e) => {
              setPreview(undefined);
              setPreviewLoading(true);
              setAudience(e.target.value as ChallengeEmailAudience);
              sendKey.current = crypto.randomUUID();
            }}
          >
            <option value="missing">Students with missing decisions</option>
            <option value="all">All enrolled students</option>
          </select>
        </label>
        {error && (
          <p role="alert" className="text-red-500 my-3">
            {error}
          </p>
        )}
        {previewLoading && <p className="my-3">Loading preview…</p>}
        {preview && (
          <div className="my-4 space-y-3">
            <p className="font-medium">
              {preview.recipientCount} eligible student
              {preview.recipientCount === 1 ? "" : "s"}
            </p>
            <div className="rounded border border-current/10 p-4 space-y-3">
              <p>
                <strong>Subject:</strong> {preview.subject}
              </p>
              <p>SCALE · {preview.templateData.classroom.name}</p>
              <h3 className="font-semibold">
                {audience === "all"
                  ? "Your challenge is available"
                  : "Your decisions are still needed"}
              </h3>
              <p>
                {audience === "all"
                  ? "Review the challenge"
                  : "You have not submitted your decisions for"}{" "}
                <strong>{preview.templateData.challenge.title}</strong>.
              </p>
              {preview.templateData.deadline && (
                <p>
                  <strong>Submission deadline:</strong>{" "}
                  {preview.templateData.deadline} (
                  {preview.templateData.timezone})
                </p>
              )}
              <p>
                {audience === "all"
                  ? "Open the challenge to review the details and your submission."
                  : "Open the challenge and submit your decisions while submissions are available."}
              </p>
              <a
                className="underline"
                href={preview.templateData.link}
                target="_blank"
                rel="noreferrer"
              >
                Open challenge
              </a>
            </div>
            <p className="text-text-muted text-sm">
              Recipient eligibility is checked again before sending. Delivery
              status appears in send history.
            </p>
            {preview.unavailable && <p role="status">{preview.unavailable}</p>}
            {(preview.deliveryDisabled || preview.suppressed) && (
              <p role="status">
                {preview.suppressed
                  ? "Notifications are suppressed for this challenge."
                  : "Email delivery is disabled."}{" "}
                Emails will be recorded as skipped.
              </p>
            )}
          </div>
        )}
        <button
          type="button"
          className="btn-teal"
          disabled={
            busy ||
            previewLoading ||
            !preview ||
            !!preview.unavailable ||
            preview.recipientCount === 0
          }
          onClick={() =>
            void act(async () => {
              await service.send(challengeId, audience, sendKey.current);
              sendKey.current = crypto.randomUUID();
              setOpen(false);
            }, "Email request processed. Check send history for delivery status.")
          }
        >
          {busy ? "Processing…" : "Send now"}
        </button>
      </Dialog>
    </section>
  );
}
