import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useUser } from "@clerk/clerk-react";
import profileService from "../../services/profile";
import type { Profile } from "../../types/profile";
import type { LedgerEntry } from "../../types/ledger";
import LoadingOverlay from "../LoadingOverlay";
import MetricsKpiRow from "../Metrics/MetricsKpiRow";

const ProfileHeader: React.FC = () => {
  const { activeClassroom } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;
  const metricDefinitions = activeClassroom?.metricDefinitions ?? [];

  useEffect(() => {
    if (!classroomId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data } = await profileService.getStudentStore(classroomId);
        setProfile(data);
      } catch (err) {
        console.error("Failed to fetch profile header data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [classroomId, user?.id]);

  const ledgerEntries = useMemo(() => {
    const list = (profile as Profile | null)?.ledgerEntries as unknown;
    return Array.isArray(list) ? (list as LedgerEntry[]) : [];
  }, [profile]);

  const toTimeMs = (d: unknown): number => {
    if (!d) return 0;
    if (d instanceof Date) return d.getTime();
    if (typeof d === "string" || typeof d === "number") {
      const t = new Date(d).getTime();
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  };

  const sortedLedgerEntries = useMemo(() => {
    if (ledgerEntries.length === 0) return [];
    return [...ledgerEntries].sort((a, b) => {
      const at = toTimeMs(a.createdDate ?? a.updatedDate);
      const bt = toTimeMs(b.createdDate ?? b.updatedDate);
      return bt - at;
    });
  }, [ledgerEntries]);

  const latestEntry = sortedLedgerEntries[0] ?? null;

  if (!profile) {
    return (
      <div className="card text-center py-8">
        <h2 className="heading-lg mb-2">No Profile Found</h2>
        <p className="text-text-muted mb-4">
          You need to create a profile before you can view your dashboard.
        </p>
        <button
          className="btn-teal"
          onClick={() => navigate("/profile")}
          type="button"
        >
          Create Profile
        </button>
      </div>
    );
  }

  return (
    <div className="student-dashboard-header">
      <LoadingOverlay loading={isLoading} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {profile.imageUrl && (
            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-ui-border bg-ui-muted">
              <img
                src={profile.imageUrl}
                alt={profile.shopName || "Profile"}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm text-text-muted">
              {activeClassroom?.name}
              {profile.profileType ? ` • ${profile.profileType}` : ""}
            </div>
            <h1 className="text-xl md:text-3xl font-semibold truncate mt-2">
              {profile.shopName?.trim() || "Your profile"}
            </h1>
            {profile.studentId && (
              <div className="text-sm text-text-muted mt-1">
                Student ID:{" "}
                <span className="text-text-primary">{profile.studentId}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {latestEntry && metricDefinitions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-base font-medium text-text-muted mb-2 uppercase tracking-wide">
            Latest Results
          </h3>
          <MetricsKpiRow entry={latestEntry} definitions={metricDefinitions} />
        </div>
      )}
    </div>
  );
};

export default ProfileHeader;
