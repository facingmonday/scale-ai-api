import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import BillingSeatsPanel from "@/components/BillingSeatsPanel";
import { useAuth } from "@/context/AuthContext";

const CLASSROOM_REDIRECT_TABS = new Set([
  "preferences",
  "definitions",
  "variableDefinitions",
  "metricDefinitions",
  "profileTypes",
  "admin",
]);

const CLASSROOM_TAB_ALIASES: Record<string, string> = {
  variableDefinitions: "definitions",
  metricDefinitions: "definitions",
  admin: "preferences",
};

const CLASSROOM_TAB_LABELS: Record<string, string> = {
  preferences: "preferences",
  definitions: "definitions",
  variableDefinitions: "definitions",
  metricDefinitions: "definitions",
  profileTypes: "profile types",
  admin: "preferences",
};

const Settings: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { activeClassroom } = useAuth();
  const tab = searchParams.get("tab");

  if (tab && CLASSROOM_REDIRECT_TABS.has(tab)) {
    const classroomTab = CLASSROOM_TAB_ALIASES[tab] ?? tab;
    if (activeClassroom?._id) {
      return (
        <Navigate
          to={`/classroom/${activeClassroom._id}?tab=${classroomTab}`}
          replace
        />
      );
    }
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <h1 className="heading-xl">Settings</h1>
            <div className="card mt-6">
              <p className="text-text-muted">
                Open a classroom from the Classrooms page to manage{" "}
                {CLASSROOM_TAB_LABELS[tab] ?? "settings"}.
              </p>
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  if (tab === "billing") {
    return <Navigate to="/settings" replace />;
  }

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <BillingSeatsPanel />
        </div>
      </div>
    </BasicLayout>
  );
};

export default Settings;
