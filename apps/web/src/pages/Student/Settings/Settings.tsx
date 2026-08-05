import React, { useEffect, useState } from "react";
import { Checkbox } from "primereact/checkbox";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import StudentBillingAccessPanel from "@/components/StudentBillingAccessPanel";

type SettingsTab = "profile" | "preferences" | "billing";

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("preferences");
  const initialAlerts = () => {
    try {
      const raw = localStorage.getItem("studentSettings.alerts");
      if (!raw) {
        return {
          alertOnScenarioCreated: false,
          alertOnLedgerCreated: false,
        };
      }
      const parsed = JSON.parse(raw) as {
        alertOnScenarioCreated?: boolean;
        alertOnLedgerCreated?: boolean;
      };
      return {
        alertOnScenarioCreated: !!parsed.alertOnScenarioCreated,
        alertOnLedgerCreated: !!parsed.alertOnLedgerCreated,
      };
    } catch {
      return {
        alertOnScenarioCreated: false,
        alertOnLedgerCreated: false,
      };
    }
  };

  const [alertOnScenarioCreated, setAlertOnScenarioCreated] = useState(
    () => initialAlerts().alertOnScenarioCreated
  );
  const [alertOnLedgerCreated, setAlertOnLedgerCreated] = useState(
    () => initialAlerts().alertOnLedgerCreated
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        "studentSettings.alerts",
        JSON.stringify({
          alertOnScenarioCreated,
          alertOnLedgerCreated,
        })
      );
    } catch {
      // ignore storage failures (e.g., private mode)
    }
  }, [alertOnScenarioCreated, alertOnLedgerCreated]);

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <h1 className="heading-xl mb-8">Settings</h1>

          {/* Tab Navigation */}
          <div className="flex gap-4 border-b border-ui-border mb-6">
            <button
              onClick={() => setActiveTab("preferences")}
              className={`px-4 py-2 -mb-px transition-colors ${
                activeTab === "preferences"
                  ? "border-b-2 border-brand-teal text-text-primary font-medium"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Preferences
            </button>
            <button
              onClick={() => setActiveTab("billing")}
              className={`px-4 py-2 -mb-px transition-colors ${
                activeTab === "billing"
                  ? "border-b-2 border-brand-teal text-text-primary font-medium"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Class Access
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === "preferences" && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Preferences</h2>
                <div className="card">
                  <h3 className="heading-md mb-1">Alerts</h3>
                  <p className="text-text-muted mb-4">
                    Choose when you want to receive in-app alerts.
                  </p>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        inputId="student-alert-challenge-created"
                        checked={alertOnScenarioCreated}
                        onChange={(e) =>
                          setAlertOnScenarioCreated(!!e.checked)
                        }
                      />
                      <div className="flex flex-col">
                        <label
                          htmlFor="student-alert-challenge-created"
                          className="text-sm font-medium"
                        >
                          Challenge created
                        </label>
                        <span className="text-xs text-text-muted">
                          Alert me when a new challenge is created for my class.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        inputId="student-alert-ledger-created"
                        checked={alertOnLedgerCreated}
                        onChange={(e) => setAlertOnLedgerCreated(!!e.checked)}
                      />
                      <div className="flex flex-col">
                        <label
                          htmlFor="student-alert-ledger-created"
                          className="text-sm font-medium"
                        >
                          Ledger created
                        </label>
                        <span className="text-xs text-text-muted">
                          Alert me when a new ledger entry is created.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "billing" && <StudentBillingAccessPanel />}
          </div>
        </div>
      </div>
    </BasicLayout>
  );
};

export default Settings;
