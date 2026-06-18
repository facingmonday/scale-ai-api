import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import BillingSeatsPanel from "@/components/BillingSeatsPanel";
import { useAuth } from "@/context/AuthContext";

const CLASSROOM_REDIRECT_TABS = new Set([
  "preferences",
  "variableDefinitions",
  "metricDefinitions",
  "profileTypes",
]);

const Settings: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { activeClassroom } = useAuth();
  const tab = searchParams.get("tab");

  if (tab && CLASSROOM_REDIRECT_TABS.has(tab)) {
    if (activeClassroom?._id) {
      return (
        <Navigate
          to={`/classroom/${activeClassroom._id}?tab=${tab}`}
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
                {tab === "preferences"
                  ? "preferences"
                  : tab === "variableDefinitions"
                    ? "variable definitions"
                    : tab === "metricDefinitions"
                      ? "metric definitions"
                      : "profile types"}
                .
              </p>
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  if (tab === "billing") {
    return (
      <Navigate to="/settings" replace />
    );
  }

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <h1 className="heading-xl">Billing & Seats</h1>
          <p className="text-text-muted mb-6">
            Manage organization seat pools and purchase additional seats.
          </p>
          <BillingSeatsPanel />
        </div>
      </div>
    </BasicLayout>
  );
};

export default Settings;
