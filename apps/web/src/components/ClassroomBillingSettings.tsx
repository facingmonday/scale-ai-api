import React, { useEffect, useState } from "react";
import classroomService from "@/services/classroom";
import licensingService from "@/services/licensing";
import type { ClassroomWithVirtuals } from "@/types/classroom";
import type { ClassroomLicensingSummary, JoinPolicy } from "@/types/licensing";

interface ClassroomBillingSettingsProps {
  classroom: ClassroomWithVirtuals;
  onClassroomUpdated?: (classroom: ClassroomWithVirtuals) => void;
  onSeatGranted?: () => void;
}

const JOIN_POLICY_LABELS: Record<JoinPolicy, string> = {
  invite_link: "Invite link required",
  open: "Open to organization members",
  roster_only: "Imported roster only",
  closed: "Closed to new enrollments",
};

const ClassroomBillingSettings: React.FC<ClassroomBillingSettingsProps> = ({
  classroom,
  onClassroomUpdated,
  onSeatGranted,
}) => {
  const classroomId = classroom._id;
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>(
    classroom.joinPolicy || "invite_link",
  );
  const [lastOpenJoinPolicy, setLastOpenJoinPolicy] = useState<JoinPolicy>(
    classroom.joinPolicy && classroom.joinPolicy !== "closed"
      ? classroom.joinPolicy
      : "invite_link",
  );
  const [allowAnonymousJoin, setAllowAnonymousJoin] = useState(
    classroom.allowAnonymousJoin !== false,
  );
  const [summary, setSummary] = useState<ClassroomLicensingSummary | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgSeatsAvailable, setOrgSeatsAvailable] = useState<number | null>(
    null,
  );
  const [grantUserId, setGrantUserId] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [isGranting, setIsGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!classroomId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [summaryData, billingSummary] = await Promise.all([
        licensingService.getClassroomSummary(classroomId),
        licensingService.getSummary(),
      ]);
      setSummary(summaryData);
      const available =
        billingSummary.orgSeatSummary?.floatingAvailable ??
        billingSummary.orgSeatSummary?.remainingSeats ??
        null;
      setOrgSeatsAvailable(
        typeof available === "number" ? available : null,
      );
    } catch (e) {
      console.error("Failed to load classroom licensing:", e);
      setError("Failed to load classroom access settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId]);

  const saveSettings = async (overrides?: {
    joinPolicy?: JoinPolicy;
    allowAnonymousJoin?: boolean;
  }) => {
    const nextJoinPolicy = overrides?.joinPolicy ?? joinPolicy;
    const nextAllowAnonymousJoin =
      overrides?.allowAnonymousJoin ?? allowAnonymousJoin;

    setIsSaving(true);
    setError(null);
    try {
      const response = await classroomService.update(classroomId, {
        joinPolicy: nextJoinPolicy,
        allowAnonymousJoin: nextAllowAnonymousJoin,
      });
      const updated = response?.data || {
        ...classroom,
        joinPolicy: nextJoinPolicy,
        allowAnonymousJoin: nextAllowAnonymousJoin,
      };
      setJoinPolicy(nextJoinPolicy);
      setAllowAnonymousJoin(nextAllowAnonymousJoin);
      onClassroomUpdated?.(updated);
      await load();
    } catch (e) {
      console.error("Failed to save classroom access settings:", e);
      setError("Failed to save access settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const isClosed = joinPolicy === "closed";

  const handleEnrollmentToggle = (closed: boolean) => {
    if (closed) {
      if (joinPolicy !== "closed") {
        setLastOpenJoinPolicy(joinPolicy);
      }
      void saveSettings({ joinPolicy: "closed" });
      return;
    }

    void saveSettings({ joinPolicy: lastOpenJoinPolicy });
  };

  const handleGrantSeat = async () => {
    if (!classroomId || isGranting) return;
    const trimmedUserId = grantUserId.trim();
    if (!trimmedUserId) {
      setGrantError("Enter a student user ID.");
      return;
    }

    setIsGranting(true);
    setGrantError(null);
    setGrantSuccess(null);
    try {
      await licensingService.grantSeat({
        userId: trimmedUserId,
        classroomId,
        source: "manual_comp",
        reason: grantReason.trim() || undefined,
      });
      setGrantSuccess("Seat granted and student enrolled.");
      setGrantUserId("");
      setGrantReason("");
      onSeatGranted?.();
      await load();
    } catch (e) {
      console.error("Failed to grant seat:", e);
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setGrantError(message || "Failed to grant seat.");
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="heading-md">Enrollment Controls</h2>
        <p className="text-text-muted">
          Control who can enroll in this class. Seat billing is managed at the
          organization level.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="label mb-0">Enrollment</span>
        <div
          className="inline-flex rounded-lg border border-ui-border p-1 bg-ui-bg-hover"
          role="group"
          aria-label="Enrollment status"
        >
          <button
            type="button"
            className={`min-w-[5.5rem] px-4 py-2 rounded-md text-sm font-medium transition-all ${
              !isClosed
                ? "bg-brand-teal text-white shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
            disabled={isSaving || !isClosed}
            aria-pressed={!isClosed}
            onClick={() => handleEnrollmentToggle(false)}
          >
            Open
          </button>
          <button
            type="button"
            className={`min-w-[5.5rem] px-4 py-2 rounded-md text-sm font-medium transition-all ${
              isClosed
                ? "bg-ui-muted text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
            disabled={isSaving || isClosed}
            aria-pressed={isClosed}
            onClick={() => handleEnrollmentToggle(true)}
          >
            Closed
          </button>
        </div>
        {isSaving && <span className="text-text-muted text-sm">Saving...</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="label">Join Policy</span>
          <select
            className="input"
            value={isClosed ? lastOpenJoinPolicy : joinPolicy}
            onChange={(e) => {
              const next = e.target.value as JoinPolicy;
              setJoinPolicy(next);
              if (next !== "closed") {
                setLastOpenJoinPolicy(next);
              }
            }}
            disabled={isSaving || isClosed}
          >
            {(Object.keys(JOIN_POLICY_LABELS) as JoinPolicy[])
              .filter((policy) => policy !== "closed")
              .map((policy) => (
                <option key={policy} value={policy}>
                  {JOIN_POLICY_LABELS[policy]}
                </option>
              ))}
          </select>
          {isClosed && (
            <p className="text-text-muted text-xs mt-1">
              Set enrollment to Open to change join policy.
            </p>
          )}
        </label>

        <div className="flex flex-col gap-3 justify-end pb-1">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowAnonymousJoin}
              onChange={(e) => setAllowAnonymousJoin(e.target.checked)}
              disabled={isSaving}
              className="w-4 h-4 rounded border-ui-border text-brand-teal focus:ring-brand-teal"
            />
            <span className="text-sm">
              Allow students with the invite link who are not on the roster
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          className="btn-teal"
          disabled={isSaving}
          onClick={() => void saveSettings()}
        >
          {isSaving ? "Saving..." : "Save Access Settings"}
        </button>
      </div>

      <div className="border-t border-ui-border pt-6 space-y-4">
        <div>
          <h3 className="heading-sm mb-1">Grant Organization Seat</h3>
          <p className="text-text-muted text-sm">
            Enroll a student using an organization seat without checkout. This
            consumes one seat from your org pool
            {orgSeatsAvailable !== null
              ? ` (${orgSeatsAvailable} available).`
              : "."}{" "}
            {summary
              ? `This class currently has ${summary.claimedSeats} claimed seat${summary.claimedSeats === 1 ? "" : "s"}.`
              : null}
          </p>
        </div>

        {grantError && <p className="text-red-400 text-sm">{grantError}</p>}
        {grantSuccess && (
          <p className="text-green-400 text-sm">{grantSuccess}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="label">Student user ID</span>
            <input
              className="input"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              placeholder="MongoDB user _id"
              disabled={isGranting}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Reason (optional)</span>
            <input
              className="input"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              placeholder="e.g. TA access, makeup enrollment"
              disabled={isGranting}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-teal"
            disabled={
              isGranting ||
              isLoading ||
              (orgSeatsAvailable !== null && orgSeatsAvailable <= 0)
            }
            onClick={() => void handleGrantSeat()}
          >
            {isGranting ? "Granting..." : "Grant Seat"}
          </button>
        </div>
      </div>

      {/* <div className="border-t border-ui-border pt-6">
        <h3 className="heading-sm mb-3">Seat Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded border border-ui-border">
            <p className="text-xs text-text-muted">Seats Claimed</p>
            <p className="text-xl font-semibold">
              {isLoading ? "..." : (summary?.claimedSeats ?? 0)}
            </p>
          </div>
          <div className="p-3 rounded border border-ui-border">
            <p className="text-xs text-text-muted">Roster Reserved</p>
            <p className="text-xl font-semibold">
              {isLoading ? "..." : (summary?.roster.reserved ?? 0)}
            </p>
          </div>
          <div className="p-3 rounded border border-ui-border">
            <p className="text-xs text-text-muted">Roster Claimed</p>
            <p className="text-xl font-semibold">
              {isLoading ? "..." : (summary?.roster.claimed ?? 0)}
            </p>
          </div>
        </div>
      </div> */}
    </div>
  );
};

export default ClassroomBillingSettings;
