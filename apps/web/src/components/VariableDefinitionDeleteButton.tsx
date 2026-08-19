import React, { useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import variableDefinitionsService from "../services/variableDefinition";
import type { VariableDefinition } from "../types/variableDefinition";
import { useGlobalContext } from "../context/GlobalContext";
import { getErrorMessage } from "../utils";

type Props = {
  classroomId: string;
  challengeId: string;
  variableDefinition: VariableDefinition;
  onDeleted?: () => void;
};

const VariableDefinitionDeleteButton: React.FC<Props> = ({
  classroomId,
  challengeId,
  variableDefinition,
  onDeleted,
}) => {
  const globalContext = useGlobalContext();
  const [visible, setVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleHide = () => {
    if (isDeleting) return;
    setVisible(false);
    setError(null);
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    setError(null);
    try {
      await variableDefinitionsService.remove(
        variableDefinition.key,
        classroomId,
        challengeId,
      );
      globalContext?.showToast?.("Challenge variable removed", "success");
      setVisible(false);
      onDeleted?.();
    } catch (deleteError) {
      console.error("Failed to remove challenge variable:", deleteError);
      setError(getErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg border border-red-500 bg-transparent px-4 py-2 font-semibold text-red-500 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setVisible(true)}
        aria-label={`Remove ${variableDefinition.label}`}
        title="Remove challenge variable"
      >
        <i className="pi pi-trash" aria-hidden="true" />
        <span>Delete</span>
      </button>

      <Dialog
        header="Remove Challenge Variable"
        visible={visible}
        onHide={handleHide}
        modal
        closable={!isDeleting}
        dismissableMask={!isDeleting}
        closeOnEscape={!isDeleting}
        className="modal w-full max-w-2xl"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="modal-content"
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-outline"
              onClick={handleHide}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <Button
              type="button"
              label="Remove Variable"
              icon="pi pi-trash"
              severity="danger"
              onClick={() => void handleDelete()}
              loading={isDeleting}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">
            Remove <strong>{variableDefinition.label}</strong> from this
            challenge? Students will no longer see or answer this variable.
          </p>
          <p className="text-sm text-text-muted">
            Previously submitted answers remain available in historical
            records.
          </p>
          {error && (
            <div
              className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
};

export default VariableDefinitionDeleteButton;
