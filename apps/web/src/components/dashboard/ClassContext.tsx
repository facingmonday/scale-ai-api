import React from "react";
import { useNavigate } from "react-router-dom";
import type { ClassDashboard } from "@/types/dashboard";

interface ClassContextProps {
  dashboard: ClassDashboard | null;
  isLoadingDashboard: boolean;
  dashboardError: string | null;
  activeClassroomName: string;
  scenarioWeekNumber: number | null;
  activeClassroomId: string;
}

const ClassContext: React.FC<ClassContextProps> = ({
  dashboard,
  isLoadingDashboard,
  dashboardError,
  activeClassroomName,
  scenarioWeekNumber,
  activeClassroomId,
}) => {
  const navigate = useNavigate();

  return (
    <div className="card">
      <h2 className="heading-md">Class context</h2>
      {isLoadingDashboard ? (
        <p className="text-text-muted mt-2">Loading…</p>
      ) : dashboardError ? (
        <p className="text-red-400 mt-2">{dashboardError}</p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Class</span>
            <span className="font-medium">
              {dashboard?.className || activeClassroomName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Term / section</span>
            <span className="text-text-muted">—</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Status</span>
            {dashboard?.isActive ? (
              <span className="badge-success">Active</span>
            ) : (
              <span className="badge bg-ui-muted text-text-secondary">
                Closed
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Current week</span>
            <span className="text-text-muted">
              {scenarioWeekNumber ? `Week ${scenarioWeekNumber}` : "—"}
            </span>
          </div>
          <button
            type="button"
            className="btn-outline w-full mt-2"
            onClick={() =>
              navigate(
                `/classrooms?edit=${encodeURIComponent(activeClassroomId)}`
              )
            }
          >
            Classroom settings
          </button>
        </div>
      )}
    </div>
  );
};

export default ClassContext;
