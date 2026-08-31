import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalContext } from "../../../context/GlobalContext";
import metricDefinitionsService from "../../../services/metricDefinition";
import type { MetricDefinition } from "../../../types/metric";
import MetricDefinitionsAddButton from "../../../components/Metrics/MetricDefinitionsAddButton";

type Props = {
  classroomId?: string | null;
};

const MetricDefinitions: React.FC<Props> = ({ classroomId: classroomIdProp }) => {
  const { activeClassroom } = useAuth();
  const globalContext = useGlobalContext();
  const classroomId = classroomIdProp ?? activeClassroom?._id ?? null;

  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [metricToDelete, setMetricToDelete] = useState<MetricDefinition | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDefinitions = useCallback(async () => {
    if (!classroomId) {
      setDefinitions([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await metricDefinitionsService.getAll(
        classroomId,
        !showActiveOnly
      );
      const data = (response?.data ?? response ?? []) as MetricDefinition[];
      setDefinitions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch metric definitions:", e);
      setError("Failed to load metric definitions");
    } finally {
      setIsLoading(false);
    }
  }, [classroomId, showActiveOnly]);

  useEffect(() => {
    // The request synchronizes this screen with the selected classroom.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDefinitions();
  }, [fetchDefinitions]);

  const filteredDefinitions = useMemo(
    () =>
      showActiveOnly
        ? definitions.filter((d) => d.isActive !== false)
        : definitions,
    [definitions, showActiveOnly]
  );

  const handleDeleteConfirm = async () => {
    if (!metricToDelete || !classroomId) return;
    setIsDeleting(true);
    try {
      await metricDefinitionsService.remove(metricToDelete.key, classroomId);
      globalContext?.showToast?.("Metric definition deleted", "success");
      setMetricToDelete(null);
      void fetchDefinitions();
    } catch (e) {
      console.error("Failed to delete metric definition:", e);
      globalContext?.showToast?.("Failed to delete metric definition", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!classroomId) {
    return (
      <div className="card">
        <p className="text-text-muted">
          Select a classroom to manage metric definitions.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => void fetchDefinitions()} className="btn-teal">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="heading-lg">Metric Definitions</h2>
          <p className="text-text-muted">
            Define the outputs the AI should compute and the UI should render
            for this classroom (KPIs, charts, tables).
          </p>
        </div>

        <MetricDefinitionsAddButton
          classroomId={classroomId}
          variant="create"
          onSaved={() => {
            globalContext?.showToast?.("Metric saved", "success");
            void fetchDefinitions();
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          inputId="isActive-filter"
          checked={showActiveOnly}
          onChange={(e) => setShowActiveOnly(!!e.checked)}
        />
        <label htmlFor="isActive-filter" className="label cursor-pointer">
          Show active only
        </label>
      </div>

      <DataTable
        value={filteredDefinitions}
        dataKey="key"
        emptyMessage="No metric definitions found"
        loading={isLoading}
      >
        <Column field="label" header="Label" sortable sortField="label" />
        <Column field="key" header="Key" sortable sortField="key" />
        <Column field="dataType" header="Type" sortable sortField="dataType" />
        <Column field="format" header="Format" sortable sortField="format" />
        <Column
          field="aggregation"
          header="Aggregation"
          sortable
          sortField="aggregation"
        />
        <Column
          header="Display In"
          body={(row: MetricDefinition) => {
            const slots = (
              ["table", "kpi", "chart", "leaderboard", "detail"] as const
            ).filter((s) => row.displayIn?.[s]);
            return slots.length > 0 ? slots.join(", ") : "—";
          }}
        />
        <Column
          header="Leaderboard"
          body={(row: MetricDefinition) =>
            row.displayIn?.leaderboard
              ? `${row.leaderboardSortDirection === "asc" ? "Ascending" : "Descending"}${row.isPrimaryLeaderboardMetric ? " · Primary" : ""}`
              : "—"
          }
        />
        <Column
          field="isActive"
          header="Active"
          body={(row: MetricDefinition) =>
            row.isActive !== false ? "Yes" : "No"
          }
          sortable
          sortField="isActive"
        />
        <Column
          header="Actions"
          body={(row: MetricDefinition) => (
            <div className="flex justify-end gap-2">
              <MetricDefinitionsAddButton
                classroomId={classroomId}
                variant="edit"
                metricDefinition={row}
                onSaved={() => {
                  globalContext?.showToast?.("Metric updated", "success");
                  void fetchDefinitions();
                }}
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                onClick={() => setMetricToDelete(row)}
                aria-label="Delete metric definition"
              />
            </div>
          )}
        />
      </DataTable>

      <Dialog
        header="Delete Metric Definition"
        visible={!!metricToDelete}
        onHide={() => !isDeleting && setMetricToDelete(null)}
        modal
        closable={!isDeleting}
        dismissableMask={!isDeleting}
        className="modal w-full max-w-2xl"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="modal-content"
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              text
              onClick={() => setMetricToDelete(null)}
              disabled={isDeleting}
            />
            <Button
              label="Delete Metric"
              icon="pi pi-check"
              onClick={handleDeleteConfirm}
              severity="danger"
              loading={isDeleting}
            />
          </div>
        }
      >
        <p className="text-text-muted">
          Are you sure you want to delete the metric{" "}
          <strong>{metricToDelete?.label ?? metricToDelete?.key}</strong>? Future
          ledger entries will no longer include this metric.
        </p>
      </Dialog>
    </div>
  );
};

export default MetricDefinitions;
