import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ClassDashboard } from "@/types/dashboard";
import type { Challenge, ScenarioWithVariables } from "@/types/challenge";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";

interface ClassroomHeaderProps {
  classroomName: string;
  classroomId: string;
  dashboard: ClassDashboard | null;
  isLoadingDashboard?: boolean;
  challenges: Challenge[];
}

const ClassroomHeader: React.FC<ClassroomHeaderProps> = ({
  classroomName,
  classroomId,
  dashboard,
  isLoadingDashboard = false,
  challenges,
}) => {
  const navigate = useNavigate();
  const { organization } = useAuth();
  const globalContext = useGlobalContext();

  const activeScenario = useMemo(() => {
    const s = dashboard?.activeScenario;
    if (!s) return null;
    return s as unknown as ScenarioWithVariables;
  }, [dashboard?.activeScenario]);

  const activeScenarioId = useMemo(() => {
    return activeScenario?._id || activeScenario?.id || null;
  }, [activeScenario]);

  const scenarioWeekNumber = useMemo(() => {
    if (!activeScenarioId || challenges.length === 0) return null;
    const sorted = [...challenges].sort((a, b) => {
      const aDate = new Date(
        (a.createdDate as unknown as string) || 0
      ).getTime();
      const bDate = new Date(
        (b.createdDate as unknown as string) || 0
      ).getTime();
      return aDate - bDate;
    });
    const idx = sorted.findIndex(
      (s) => ((s?._id as string) || s?.id || "") === activeScenarioId
    );
    return idx >= 0 ? idx + 1 : null;
  }, [activeScenarioId, challenges]);

  const handleCopyJoinLink = async () => {
    const orgId = organization?.id;
    if (!orgId || !classroomId) {
      globalContext?.showToast?.("Unable to generate join link", "error");
      return;
    }

    const url = new URL("/", window.location.origin);
    url.searchParams.set("orgId", orgId);
    url.searchParams.set("classroomId", classroomId);

    try {
      await navigator.clipboard.writeText(url.toString());
      globalContext?.showToast?.("Join link copied", "success");
    } catch (e) {
      // Fallback for older browsers / non-secure contexts
      try {
        const textarea = document.createElement("textarea");
        textarea.value = url.toString();
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        globalContext?.showToast?.("Join link copied", "success");
      } catch (err) {
        console.error("Failed to copy join link:", e, err);
        globalContext?.showToast?.("Failed to copy join link", "error");
      }
    }
  };

  return (
    <div className="dashboard-classroom-header w-full">
      <div className="min-w-0">
        <div className="text-sm text-text-muted">Active classroom</div>
        <div className="heading-lg truncate">{classroomName}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Term / section (optional) */}
          <span className="badge bg-ui-muted text-text-secondary">
            Term/section: —
          </span>

          {/* Class status */}
          {isLoadingDashboard ? (
            <span className="badge bg-ui-muted text-text-secondary">
              Status: loading…
            </span>
          ) : dashboard?.isActive ? (
            <span className="badge-success">Active</span>
          ) : (
            <span className="badge bg-ui-muted text-text-secondary">
              Closed
            </span>
          )}

          {/* Current week / challenge number */}
          {scenarioWeekNumber ? (
            <span className="badge bg-ui-muted text-text-secondary">
              Week {scenarioWeekNumber}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-outline"
          onClick={() => void handleCopyJoinLink()}
          title="Copy join link"
          aria-label="Copy join link"
        >
          <i className="pi pi-link" />
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            navigate(`/classroom/${classroomId}`);
          }}
          aria-label="Edit classroom"
          title="Edit classroom"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
            />
          </svg>
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
};

export default ClassroomHeader;
