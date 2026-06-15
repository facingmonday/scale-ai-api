import React, { useEffect, useMemo, useState } from "react";
import classroomService from "@/services/classroom";
import licensingService from "@/services/licensing";
import type { ClassroomWithVirtuals } from "@/types/classroom";
import type {
  BillingMode,
  ClassroomLicensingSummary,
  JoinPolicy,
  SeatPool,
} from "@/types/licensing";

interface ClassroomBillingSettingsProps {
  classroom: ClassroomWithVirtuals;
  onClassroomUpdated?: (classroom: ClassroomWithVirtuals) => void;
}

const billingModes: Array<{ value: BillingMode; label: string; help: string }> = [
  {
    value: "student_paid",
    label: "Student paid",
    help: "Students pay individually before joining this classroom.",
  },
  {
    value: "teacher_paid_roster",
    label: "Teacher paid, roster only",
    help: "Only imported roster students can claim seats.",
  },
];

const ClassroomBillingSettings: React.FC<ClassroomBillingSettingsProps> = ({
  classroom,
  onClassroomUpdated,
}) => {
  const classroomId = classroom._id;
  const [billingMode, setBillingMode] = useState<BillingMode>(
    classroom.billingMode || "student_paid"
  );
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>(
    classroom.joinPolicy || "invite_link"
  );
  const [studentPaysAllowed, setStudentPaysAllowed] = useState(
    classroom.studentPaysAllowed !== false
  );
  const [allowAnonymousJoin, setAllowAnonymousJoin] = useState(
    classroom.allowAnonymousJoin !== false
  );
  const [summary, setSummary] = useState<ClassroomLicensingSummary | null>(null);
  const [seatPools, setSeatPools] = useState<SeatPool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [seatsToAllocate, setSeatsToAllocate] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(
    () => billingModes.find((mode) => mode.value === billingMode),
    [billingMode]
  );

  const load = async () => {
    if (!classroomId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [summaryData, poolsData] = await Promise.all([
        licensingService.getClassroomSummary(classroomId),
        licensingService.getSeatPools(),
      ]);
      setSummary(summaryData);
      setSeatPools(poolsData);
    } catch (e) {
      console.error("Failed to load classroom licensing:", e);
      setError("Failed to load classroom billing settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId]);

  const saveSettings = async () => {
    setIsSaving(true);
    setError(null);
    const updatedStudentPaysAllowed = billingMode === "student_paid";
    try {
      const response = await classroomService.update(classroomId, {
        billingMode,
        joinPolicy,
        studentPaysAllowed: updatedStudentPaysAllowed,
        allowAnonymousJoin,
      });
      const updated = response?.data || {
        ...classroom,
        billingMode,
        joinPolicy,
        studentPaysAllowed: updatedStudentPaysAllowed,
        allowAnonymousJoin,
      };
      onClassroomUpdated?.(updated);
      await load();
    } catch (e) {
      console.error("Failed to save classroom billing settings:", e);
      setError("Failed to save billing settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const allocateSeats = async () => {
    if (!selectedPoolId || seatsToAllocate <= 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await licensingService.allocateSeats(classroomId, {
        seatPoolId: selectedPoolId,
        seatsAllocated: seatsToAllocate,
        mode:
          billingMode === "teacher_paid_roster" || billingMode === "roster_only"
            ? "roster_reserved"
            : "open",
      });
      setSeatsToAllocate(0);
      await load();
    } catch (e) {
      console.error("Failed to allocate seats:", e);
      setError("Failed to allocate seats to this classroom.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="heading-md">Billing & Seat Access</h2>
        <p className="text-text-muted">
          Decide who pays for this class and how students are allowed to claim
          seats.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {billingModes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => {
              setBillingMode(mode.value);
              if (mode.value === "teacher_paid_roster") {
                setJoinPolicy("roster_only");
              }
            }}
            className={`text-left p-4 rounded-lg border transition-colors ${
              billingMode === mode.value
                ? "border-brand-teal bg-brand-teal/10"
                : "border-ui-border hover:border-brand-teal/70"
            }`}
          >
            <p className="font-semibold">{mode.label}</p>
            <p className="text-sm text-text-muted">{mode.help}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="label">Join Policy</span>
          <select
            className="input"
            value={joinPolicy}
            onChange={(e) => setJoinPolicy(e.target.value as JoinPolicy)}
          >
            <option value="invite_link">Invite link</option>
            <option value="open">Open to organization members</option>
            <option value="roster_only">Imported roster only</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <div className="flex flex-col gap-3 justify-end pb-1">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowAnonymousJoin}
              onChange={(e) => setAllowAnonymousJoin(e.target.checked)}
              className="w-4 h-4 rounded border-ui-border text-brand-teal focus:ring-brand-teal"
            />
            <span className="text-sm">Allow anonymous students to join (any user with the link)</span>
          </label>
        </div>
      </div>

      {selectedMode && (
        <p className="text-sm text-text-muted">
          Current mode: <strong>{selectedMode.label}</strong>.{" "}
          {selectedMode.help}
        </p>
      )}

      <div className="flex justify-end">
        <button
          className="btn-teal"
          disabled={isSaving}
          onClick={() => void saveSettings()}
        >
          {isSaving ? "Saving..." : "Save Billing Settings"}
        </button>
      </div>

      <div className="border-t border-ui-border pt-6">
        <h3 className="heading-sm mb-3">Seat Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded border border-ui-border">
            <p className="text-xs text-text-muted">Claimed</p>
            <p className="text-xl font-semibold">
              {isLoading ? "..." : summary?.claimedSeats ?? 0}
            </p>
          </div>
          <div className="p-3 rounded border border-ui-border">
            <p className="text-xs text-text-muted">Roster Reserved</p>
            <p className="text-xl font-semibold">
              {isLoading ? "..." : summary?.roster.reserved ?? 0}
            </p>
          </div>
          <div className="p-3 rounded border border-ui-border">
            <p className="text-xs text-text-muted">Roster Claimed</p>
            <p className="text-xl font-semibold">
              {isLoading ? "..." : summary?.roster.claimed ?? 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassroomBillingSettings;
