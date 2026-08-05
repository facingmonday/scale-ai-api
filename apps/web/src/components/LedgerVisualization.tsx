import React, { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import ledgerService from "../services/ledger";
import { useAuth } from "../context/AuthContext";
import { useGlobalContext } from "../context/GlobalContext";
import { getErrorMessage } from "../utils";
import type { LedgerEntry } from "../types/ledger";
import type { MetricDefinition } from "../types/metric";
import { MetricsKpiRow, MetricsDisplay } from "./Metrics";
import {
  filterMetricsForDisplay,
  formatMetricValue,
  getMetricValue,
  sortMetricDefinitions,
} from "../utils/formatMetric";

interface LedgerVisualizationProps {
  ledger: LedgerEntry | null;
  /**
   * Optional metric definitions. If not provided, falls back to
   * activeClassroom.metricDefinitions in context.
   */
  metricDefinitions?: MetricDefinition[];
  onUpdate?: () => void;
}

const LedgerVisualization: React.FC<LedgerVisualizationProps> = ({
  ledger,
  metricDefinitions,
  onUpdate,
}) => {
  const { userRole, activeClassroom } = useAuth();
  const globalContext = useGlobalContext();
  const isAdmin = userRole === "org:admin";
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);

  const defs = useMemo<MetricDefinition[]>(
    () =>
      metricDefinitions ??
      activeClassroom?.metricDefinitions ??
      [],
    [metricDefinitions, activeClassroom?.metricDefinitions]
  );

  // Edit state for metrics (one per active metric)
  const [editedMetrics, setEditedMetrics] = useState<Record<string, unknown>>(
    {}
  );
  const [summary, setSummary] = useState(ledger?.summary || "");
  const [randomEvent, setRandomEvent] = useState(ledger?.randomEvent || "");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setEditedMetrics(ledger?.metrics ?? {});
    setSummary(ledger?.summary || "");
    setRandomEvent(ledger?.randomEvent || "");
    setReason("");
  }, [ledger]);

  if (!ledger) {
    return (
      <div className="text-text-muted text-sm">No ledger entry yet.</div>
    );
  }

  const handleSave = async () => {
    if (!ledger) return;
    setIsSaving(true);
    try {
      await ledgerService.overrideEntry(ledger._id as string, {
        metrics: editedMetrics,
        summary: summary || undefined,
        randomEvent: randomEvent || undefined,
        reason: reason || undefined,
      });
      globalContext?.showToast?.("Ledger entry updated", "success");
      setIsEditing(false);
      onUpdate?.();
    } catch (e) {
      console.error(e);
      globalContext?.showToast?.(getErrorMessage(e), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const editableDefs = sortMetricDefinitions(
    defs.filter((d) => d.isActive !== false)
  );

  return (
    <div className="flex flex-col gap-6">
      <MetricsKpiRow entry={ledger} definitions={defs} />

      {ledger.summary && !isEditing && (
        <div className="card">
          <h3 className="heading-md mb-2">Summary</h3>
          <p className="text-text-secondary whitespace-pre-wrap">
            {ledger.summary}
          </p>
        </div>
      )}

      {ledger.randomEvent && !isEditing && (
        <div className="card">
          <h3 className="heading-md mb-2">Random Event</h3>
          <p className="text-text-secondary">{ledger.randomEvent}</p>
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h3 className="heading-md">All Metrics</h3>
          {isAdmin && !isEditing && (
            <Button
              label="Override"
              icon="pi pi-pencil"
              text
              onClick={() => setIsEditing(true)}
            />
          )}
        </div>

        {!isEditing ? (
          <MetricsDisplay entry={ledger} definitions={defs} scope="all" />
        ) : (
          <div className="flex flex-col gap-3">
            {editableDefs.map((def) => {
              const raw = editedMetrics[def.key];
              return (
                <div
                  key={def.key}
                  className="flex items-center justify-between gap-3"
                >
                  <label className="label flex-1" htmlFor={`metric-${def.key}`}>
                    {def.label}
                    <span className="text-text-muted text-xs block">
                      ({def.format})
                    </span>
                  </label>
                  <input
                    id={`metric-${def.key}`}
                    className="input max-w-xs"
                    value={
                      raw === undefined || raw === null
                        ? ""
                        : String(raw)
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditedMetrics((prev) => ({
                        ...prev,
                        [def.key]:
                          def.dataType === "number"
                            ? v === ""
                              ? null
                              : Number(v)
                            : def.dataType === "boolean"
                              ? v === "true"
                              : v,
                      }));
                    }}
                  />
                </div>
              );
            })}

            <div>
              <label className="label" htmlFor="summary">
                Summary
              </label>
              <InputTextarea
                id="summary"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="label" htmlFor="randomEvent">
                Random Event
              </label>
              <input
                id="randomEvent"
                value={randomEvent}
                onChange={(e) => setRandomEvent(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="reason">
                Reason for adjustment
              </label>
              <InputTextarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                label="Cancel"
                text
                disabled={isSaving}
                onClick={() => {
                  setEditedMetrics(ledger.metrics ?? {});
                  setSummary(ledger.summary || "");
                  setRandomEvent(ledger.randomEvent || "");
                  setReason("");
                  setIsEditing(false);
                }}
              />
              <Button
                label={isSaving ? "Saving..." : "Save"}
                icon="pi pi-save"
                onClick={() => void handleSave()}
                disabled={isSaving}
              />
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="card">
          <button
            className="text-brand-teal text-sm"
            onClick={() => setShowCalculationDetails((v) => !v)}
          >
            {showCalculationDetails ? "Hide" : "Show"} calculation details
          </button>

          {showCalculationDetails && ledger.calculationContext && (
            <div className="mt-3 space-y-3">
              <CalculationSection
                label="Profile Variables"
                data={ledger.calculationContext.profileVariables}
              />
              <CalculationSection
                label="Challenge Variables"
                data={ledger.calculationContext.challengeVariables}
              />
              <CalculationSection
                label="Decision Variables"
                data={ledger.calculationContext.decisionVariables}
              />
              <CalculationSection
                label="Outcome Variables"
                data={ledger.calculationContext.outcomeVariables}
              />
              <CalculationSection
                label="Prior Metrics"
                data={ledger.calculationContext.priorMetrics}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CalculationSection: React.FC<{
  label: string;
  data?: Record<string, unknown>;
}> = ({ label, data }) => {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold mb-1">{label}</h4>
      <pre className="text-xs bg-card-hover p-2 rounded overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

export default LedgerVisualization;

// Suppress unused imports
void formatMetricValue;
void getMetricValue;
void filterMetricsForDisplay;
