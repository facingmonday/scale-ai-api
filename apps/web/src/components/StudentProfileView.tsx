import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import profileService from "../services/profile";
import type { Profile } from "../types/profile";
import type { LedgerEntry } from "../types/ledger";
import { unwrap } from "./dashboard/utils";
import LoadingOverlay from "./LoadingOverlay";
import MetricsKpiRow from "./Metrics/MetricsKpiRow";
import { formatProfileType } from "./dashboard/utils";

interface StudentProfileViewProps {
  studentId: string;
  classroomId: string;
}

const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  studentId,
  classroomId,
}) => {
  const { activeClassroom } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const metricDefinitions = activeClassroom?.metricDefinitions ?? [];

  useEffect(() => {
    if (!classroomId || !studentId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const profileRes = await profileService.getStudentStoreAdmin(
          classroomId,
          studentId
        );
        setProfile(unwrap(profileRes) as Profile);
      } catch (err) {
        console.error("Failed to fetch student profile:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [classroomId, studentId]);

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
          This student hasn't created a profile yet.
        </p>
      </div>
    );
  }

  return (
    <div className="card flex flex-row gap-4">
      <LoadingOverlay loading={isLoading} />
      <div className="w-1/4">
        {profile.imageUrl ? (
          <img
            src={profile.imageUrl}
            alt={profile.shopName}
            className="w-full aspect-square object-cover rounded-lg"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-square rounded-lg border border-ui-border bg-ui-muted flex items-center justify-center">
            <i className="pi pi-user text-4xl text-text-muted" aria-hidden />
            <span className="sr-only">No profile image</span>
          </div>
        )}
      </div>
      <div className="w-3/4">
        <div className="min-w-0">
          <div className="text-sm text-text-muted">
            {activeClassroom?.name}
            {profile.profileType
              ? ` • ${formatProfileType(profile.profileType)}`
              : ""}
          </div>
          <h2 className="text-xl md:text-3xl font-semibold truncate mt-2">
            {profile.shopName?.trim() || "Student's profile"}
          </h2>
          {profile.studentId && (
            <div className="text-sm text-text-muted mt-1">
              Student ID:{" "}
              <span className="text-text-primary">{profile.studentId}</span>
            </div>
          )}

          <dl className="mt-4 grid gap-4 border-t border-ui-border pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Location
              </dt>
              <dd className="mt-1 break-words text-text-primary">
                {profile.storeLocation?.trim() || "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Description
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-text-primary">
                {profile.storeDescription?.trim() || "Not provided"}
              </dd>
            </div>
          </dl>
        </div>

        {latestEntry && metricDefinitions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-base font-medium text-text-muted mb-2 uppercase tracking-wide">
              Latest Results
            </h3>
            <MetricsKpiRow
              entry={latestEntry}
              definitions={metricDefinitions}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfileView;
