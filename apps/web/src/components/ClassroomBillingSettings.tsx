import React, { useEffect, useState } from "react";
import classroomService from "@/services/classroom";
import licensingService from "@/services/licensing";
import type { ClassroomWithVirtuals } from "@/types/classroom";
import type { ClassroomLicensingSummary, JoinPolicy } from "@/types/licensing";

interface ClassroomBillingSettingsProps {
  classroom: ClassroomWithVirtuals;
  onClassroomUpdated?: (classroom: ClassroomWithVirtuals) => void;
}

const ClassroomBillingSettings: React.FC<ClassroomBillingSettingsProps> = ({
  classroom,
  onClassroomUpdated,
}) => {
  const classroomId = classroom._id;
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>(
    classroom.joinPolicy || "invite_link",
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

  const load = async () => {
    if (!classroomId) return;
    setIsLoading(true);
    setError(null);
    try {
      const summaryData =
        await licensingService.getClassroomSummary(classroomId);
      setSummary(summaryData);
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

  const saveSettings = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await classroomService.update(classroomId, {
        joinPolicy,
        allowAnonymousJoin,
      });
      const updated = response?.data || {
        ...classroom,
        joinPolicy,
        allowAnonymousJoin,
      };
      onClassroomUpdated?.(updated);
      await load();
    } catch (e) {
      console.error("Failed to save classroom access settings:", e);
      setError("Failed to save access settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="heading-md">Class Access</h2>
        <p className="text-text-muted">
          Control who can enroll in this class. Seat billing is managed at the
          organization level.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

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

      {/* <div className="border-t border-ui-border pt-6">
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
      </div> */}
    </div>
  );
};

export default ClassroomBillingSettings;
