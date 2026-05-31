import React, { useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import classroomService from "@/services/classroom";
import { useGlobalContext } from "@/context/GlobalContext";

type Props = {
  classroomId: string;
  disabled?: boolean;
};

const ClassroomResetVariablesAction: React.FC<Props> = ({
  classroomId,
  disabled = false,
}) => {
  const globalContext = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    setError(null);
    try {
      await classroomService.removeAllVariables(classroomId);
      globalContext?.showToast?.("Classroom variables cleared", "success");
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to reset classroom variables:", e);
      const errorMessage =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setError(errorMessage || "Failed to reset variables. Please try again.");
      globalContext?.showToast?.(
        errorMessage || "Failed to reset variables",
        "error"
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <div className="danger-zone-row">
        <div>
          <h3 className="font-semibold mb-1">Reset classroom variables</h3>
          <p className="text-text-muted text-sm">
            Deletes all variable definitions and variable values for this
            classroom.
          </p>
        </div>
        <Button
          label="Reset Variables"
          icon="pi pi-refresh"
          onClick={() => setIsOpen(true)}
          severity="danger"
          outlined
          className="[&_.p-button-icon]:mr-3"
          disabled={disabled}
        />
      </div>

      <Dialog
        header="Reset classroom variables"
        visible={isOpen}
        onHide={() => !isResetting && setIsOpen(false)}
        modal
        closable={!isResetting}
        dismissableMask={!isResetting}
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
              onClick={() => setIsOpen(false)}
              text
              disabled={isResetting}
            />
            <Button
              label="Reset Variables"
              icon="pi pi-check"
              onClick={handleReset}
              severity="danger"
              loading={isResetting}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-danger font-medium">{error}</p> : null}
          <p className="text-text-muted">
            This will permanently delete all{" "}
            <strong>variable definitions</strong> and{" "}
            <strong>variable values</strong> for this classroom.
          </p>
          <p className="text-danger font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Dialog>
    </>
  );
};

export default ClassroomResetVariablesAction;


