import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalContext } from "../../../context/GlobalContext";
import variableDefinitionsService from "../../../services/variableDefinition";
import type { VariableDefinition } from "../../../types/variableDefinition";
import VariableDefinitionsAddButton from "../../../components/VariableDefinitionsAddButton";

const VariableDefinitions: React.FC = () => {
  const { activeClassroom } = useAuth();
  const globalContext = useGlobalContext();
  const classroomId = activeClassroom?._id || null;

  const [definitions, setDefinitions] = useState<VariableDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliesToFilter, setAppliesToFilter] = useState<
    VariableDefinition["appliesTo"] | ""
  >("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [variableToDelete, setVariableToDelete] =
    useState<VariableDefinition | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDefinitions = useCallback(async () => {
    if (!classroomId) {
      setDefinitions([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await variableDefinitionsService.getAll(
        classroomId,
        appliesToFilter || undefined
      );
      const data = (response?.data ?? response ?? []) as VariableDefinition[];
      setDefinitions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch variable definitions:", e);
      setError("Failed to load variable definitions");
    } finally {
      setIsLoading(false);
    }
  }, [classroomId, appliesToFilter]);

  useEffect(() => {
    void fetchDefinitions();
  }, [fetchDefinitions]);

  const filteredDefinitions = useMemo(
    () =>
      showActiveOnly ? definitions.filter((d) => d.isActive) : definitions,
    [definitions, showActiveOnly]
  );

  const handleDeleteClick = (variable: VariableDefinition) => {
    setVariableToDelete(variable);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!variableToDelete || !classroomId) return;

    setIsDeleting(true);
    setError(null);
    try {
      await variableDefinitionsService.remove(
        variableToDelete.key,
        classroomId
      );
      globalContext?.showToast?.("Variable definition deleted", "success");
      setShowDeleteDialog(false);
      setVariableToDelete(null);
      void fetchDefinitions();
    } catch (e) {
      console.error("Failed to delete variable definition:", e);
      globalContext?.showToast?.(
        "Failed to delete variable definition",
        "error"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!classroomId) {
    return (
      <div className="card">
        <p className="text-text-muted">
          Select a classroom to manage variable definitions.
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
          <h2 className="heading-lg">Variable Definitions</h2>
          <p className="text-text-muted">
            Manage variable definitions for challenges, profiles, and decisions.
          </p>
        </div>

        <VariableDefinitionsAddButton
          classroomId={classroomId}
          variant="create"
          onSaved={() => {
            globalContext?.showToast?.("Variable definition saved", "success");
            void fetchDefinitions();
          }}
        />
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label htmlFor="appliesTo-filter" className="label">
            Filter by applies to
          </label>
          <select
            id="appliesTo-filter"
            className="input w-auto"
            value={appliesToFilter}
            onChange={(e) =>
              setAppliesToFilter(
                e.target.value as VariableDefinition["appliesTo"] | ""
              )
            }
          >
            <option value="">All</option>
            <option value="profile">Profile</option>
            <option value="profileType">Profile Type</option>
            <option value="challenge">Challenge</option>
            <option value="decision">Decision</option>
            <option value="outcome">Outcome</option>
          </select>
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
      </div>

      <DataTable
        value={filteredDefinitions}
        dataKey="key"
        emptyMessage="No variable definitions found"
        loading={isLoading}
      >
        <Column field="label" header="Label" sortable sortField="label" />
        <Column field="appliesTo" header="Applies to" sortable sortField="appliesTo" />
        <Column field="dataType" header="Data type" sortable sortField="dataType" />
        <Column field="inputType" header="Input type" sortable sortField="inputType" />
        <Column
          field="required"
          header="Required"
          body={(row: VariableDefinition) => (row.required ? "Yes" : "No")}
          sortable
          sortField="required"
        />
        <Column
          field="isActive"
          header="Active"
          body={(row: VariableDefinition) => (row.isActive ? "Yes" : "No")}
          sortable
          sortField="isActive"
        />
        <Column field="min" header="Min" sortable sortField="min" />
        <Column field="max" header="Max" sortable sortField="max" />
        <Column
          field="defaultValue"
          header="Default"
          body={(row: VariableDefinition) => {
            const v = row.defaultValue;
            if (v === null || v === undefined) return "";
            if (typeof v === "string") return v;
            try {
              return JSON.stringify(v);
            } catch {
              return String(v);
            }
          }}
          sortable
          sortField="defaultValue"
        />
        <Column
          header="Actions"
          body={(row: VariableDefinition) => (
            <div className="flex justify-end gap-2">
              <VariableDefinitionsAddButton
                classroomId={classroomId}
                variant="edit"
                variableDefinition={row}
                onSaved={() => {
                  globalContext?.showToast?.(
                    "Variable definition updated",
                    "success"
                  );
                  void fetchDefinitions();
                }}
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                onClick={() => handleDeleteClick(row)}
                aria-label="Delete variable definition"
              />
            </div>
          )}
        />
      </DataTable>

      {/* Delete Variable Definition Dialog */}
      <Dialog
        header="Delete Variable Definition"
        visible={showDeleteDialog}
        onHide={() => !isDeleting && setShowDeleteDialog(false)}
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
              icon="pi pi-times"
              onClick={() => setShowDeleteDialog(false)}
              text
              disabled={isDeleting}
            />
            <Button
              label="Delete Variable Definition"
              icon="pi pi-check"
              onClick={handleDeleteConfirm}
              severity="danger"
              loading={isDeleting}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">
            Are you sure you want to permanently delete the variable definition{" "}
            <strong>
              {variableToDelete?.label ||
                variableToDelete?.key ||
                "this variable"}
            </strong>
            ? This will:
          </p>
          <ul className="list-disc list-inside text-text-muted ml-4">
            <li>Remove it from all challenges, profiles, and decisions</li>
            <li>Delete all associated data</li>
            <li>Permanently delete the variable definition</li>
          </ul>
          <p className="text-red-400 font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Dialog>
    </div>
  );
};

export default VariableDefinitions;
