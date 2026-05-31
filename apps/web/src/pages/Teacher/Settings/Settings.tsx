import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Checkbox } from "primereact/checkbox";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import VariableDefinitions from "./VariableDefinitions";
import MetricDefinitions from "./MetricDefinitions";
import ProfileTypes from "./ProfileTypes";
import BillingSeatsPanel from "@/components/BillingSeatsPanel";

type SettingsTab =
  | "profile"
  | "preferences"
  | "billing"
  | "variableDefinitions"
  | "metricDefinitions"
  | "profileTypes";

const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabFromUrl = useMemo(() => {
    const raw = searchParams.get("tab");
    if (
      raw === "preferences" ||
      raw === "billing" ||
      raw === "variableDefinitions" ||
      raw === "metricDefinitions" ||
      raw === "profileTypes"
    ) {
      return raw as SettingsTab;
    }
    return null;
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabFromUrl ?? "preferences"
  );

  const [sendStudentAlertOnScenarioCreated, setSendStudentAlertOnScenarioCreated] =
    useState(true);
  const [sendStudentAlertOnLedgerCreated, setSendStudentAlertOnLedgerCreated] =
    useState(true);
  const [ledgerEntriesRequireApproval, setLedgerEntriesRequireApproval] =
    useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("teacherSettings.preferences");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        sendStudentAlertOnScenarioCreated?: boolean;
        sendStudentAlertOnLedgerCreated?: boolean;
        ledgerEntriesRequireApproval?: boolean;
      };
      if (typeof parsed.sendStudentAlertOnScenarioCreated === "boolean") {
        setSendStudentAlertOnScenarioCreated(
          parsed.sendStudentAlertOnScenarioCreated
        );
      }
      if (typeof parsed.sendStudentAlertOnLedgerCreated === "boolean") {
        setSendStudentAlertOnLedgerCreated(parsed.sendStudentAlertOnLedgerCreated);
      }
      if (typeof parsed.ledgerEntriesRequireApproval === "boolean") {
        setLedgerEntriesRequireApproval(parsed.ledgerEntriesRequireApproval);
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "teacherSettings.preferences",
        JSON.stringify({
          sendStudentAlertOnScenarioCreated,
          sendStudentAlertOnLedgerCreated,
          ledgerEntriesRequireApproval,
        })
      );
    } catch {
      // ignore storage failures (e.g., private mode)
    }
  }, [
    sendStudentAlertOnScenarioCreated,
    sendStudentAlertOnLedgerCreated,
    ledgerEntriesRequireApproval,
  ]);

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  const setTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <h1 className="heading-xl">Settings</h1>

          {/* Tab Navigation */}
          <div className="flex gap-4 border-b border-ui-border mb-2">
            <button
              onClick={() => setTab("preferences")}
              className={`px-4 py-2 -mb-px transition-colors ${
                activeTab === "preferences"
                  ? "border-b-2 border-brand-teal text-text-primary font-medium"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Preferences
            </button>
            <button
              onClick={() => setTab("billing")}
              className={`px-4 py-2 -mb-px transition-colors ${
                activeTab === "billing"
                  ? "border-b-2 border-brand-teal text-text-primary font-medium"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Billing & Seats
            </button>
            <button
              onClick={() => setTab("variableDefinitions")}
              className={`px-4 py-2 -mb-px transition-colors ${
                activeTab === "variableDefinitions"
                  ? "border-b-2 border-brand-teal text-text-primary font-medium"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Variable Definitions
            </button>
            <button
              onClick={() => setTab("metricDefinitions")}
              className={`px-4 py-2 -mb-px transition-colors ${
                activeTab === "metricDefinitions"
                  ? "border-b-2 border-brand-teal text-text-primary font-medium"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Metric Definitions
            </button>
            <button
              onClick={() => setTab("profileTypes")}
              className={`px-4 py-2 -mb-px transition-colors ${
                activeTab === "profileTypes"
                  ? "border-b-2 border-brand-teal text-text-primary font-medium"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Profile Types
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === "preferences" && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Preferences</h2>
                <div className="card space-y-6">
                  <div>
                    <h3 className="heading-md mb-1">Student alerts</h3>
                    <p className="text-text-muted">
                      Choose when students should receive in-app alerts for your
                      classroom.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        inputId="teacher-alert-students-challenge-created"
                        checked={sendStudentAlertOnScenarioCreated}
                        onChange={(e) =>
                          setSendStudentAlertOnScenarioCreated(!!e.checked)
                        }
                      />
                      <div className="flex flex-col">
                        <label
                          htmlFor="teacher-alert-students-challenge-created"
                          className="text-sm font-medium"
                        >
                          Send an alert to students when a new challenge is created
                        </label>
                        <span className="text-xs text-text-muted">
                          Helps students know when it’s time to start working on
                          a fresh challenge.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        inputId="teacher-alert-students-ledger-created"
                        checked={sendStudentAlertOnLedgerCreated}
                        onChange={(e) =>
                          setSendStudentAlertOnLedgerCreated(!!e.checked)
                        }
                      />
                      <div className="flex flex-col">
                        <label
                          htmlFor="teacher-alert-students-ledger-created"
                          className="text-sm font-medium"
                        >
                          Send an alert to students when a new ledger entry is created
                        </label>
                        <span className="text-xs text-text-muted">
                          Useful for highlighting important updates like deposits,
                          fees, or adjustments.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-ui-border pt-6">
                    <h3 className="heading-md mb-1">Approvals</h3>
                    <p className="text-text-muted mb-4">
                      Add an extra review step for ledger activity.
                    </p>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        inputId="teacher-ledger-require-approval"
                        checked={ledgerEntriesRequireApproval}
                        onChange={(e) => setLedgerEntriesRequireApproval(!!e.checked)}
                      />
                      <div className="flex flex-col">
                        <label
                          htmlFor="teacher-ledger-require-approval"
                          className="text-sm font-medium"
                        >
                          Require teacher approval before ledger entries are finalized
                        </label>
                        <span className="text-xs text-text-muted">
                          When enabled, new ledger entries will stay pending until
                          you review and approve them.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "variableDefinitions" && <VariableDefinitions />}

            {activeTab === "metricDefinitions" && <MetricDefinitions />}

            {activeTab === "billing" && <BillingSeatsPanel />}

            {activeTab === "profileTypes" && (
              <ProfileTypes returnTo="/settings?tab=profileTypes" />
            )}
          </div>
        </div>
      </div>
    </BasicLayout>
  );
};

export default Settings;
