import React, { useEffect, useState } from "react";
import { Checkbox } from "primereact/checkbox";

const TeacherPreferencesPanel: React.FC = () => {
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

  return (
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
                Helps students know when it's time to start working on a fresh
                challenge.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              inputId="teacher-alert-students-ledger-created"
              checked={sendStudentAlertOnLedgerCreated}
              onChange={(e) => setSendStudentAlertOnLedgerCreated(!!e.checked)}
            />
            <div className="flex flex-col">
              <label
                htmlFor="teacher-alert-students-ledger-created"
                className="text-sm font-medium"
              >
                Send an alert to students when a new ledger entry is created
              </label>
              <span className="text-xs text-text-muted">
                Useful for highlighting important updates like deposits, fees,
                or adjustments.
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
                When enabled, new ledger entries will stay pending until you
                review and approve them.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherPreferencesPanel;
