import React, { useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import outcomeService from "@/services/outcome";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";

type Props = {
  challengeId: string;
  scenarioName?: string;
  disabled?: boolean;
  onSuccess?: () => void | Promise<void>;
};

const ScenarioRemoveOutcomeAction: React.FC<Props> = ({
  challengeId,
  scenarioName,
  disabled = false,
  onSuccess,
}) => {
  const globalContext = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRemove = async () => {
    if (!challengeId || isProcessing) return;

    setIsProcessing(true);
    try {
      globalContext?.showToast?.("Removing challenge outcome...", "loading");
      await outcomeService.removeOutcome(challengeId);
      globalContext?.showToast?.(
        "Challenge outcome removed successfully",
        "success"
      );
      setIsOpen(false);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (e) {
      console.error("Failed to remove challenge outcome:", e);
      const errorMessage = getErrorMessage(e);
      globalContext?.showToast?.(errorMessage, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border border-red-500/20 rounded-lg">
        <div>
          <h3 className="font-semibold mb-1">Remove Challenge Outcome</h3>
          <p className="text-text-muted text-sm">
            Delete the challenge outcome data. This will remove all outcome
            information associated with this challenge.
          </p>
        </div>
        <Button
          label="Remove Outcome"
          icon="pi pi-times-circle"
          onClick={() => setIsOpen(true)}
          severity="danger"
          outlined
          className="[&_.p-button-icon]:mr-3"
          disabled={disabled}
        />
      </div>

      <Dialog
        header="Remove Challenge Outcome"
        visible={isOpen}
        onHide={() => !isProcessing && setIsOpen(false)}
        style={{ width: "50vw" }}
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
              disabled={isProcessing}
            />
            <Button
              label="Remove Outcome"
              icon="pi pi-check"
              onClick={handleRemove}
              severity="danger"
              loading={isProcessing}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">
            Are you sure you want to remove the challenge outcome for{" "}
            <strong>{scenarioName || "this challenge"}</strong>? This will delete
            all outcome information associated with this challenge. This action
            cannot be undone.
          </p>
        </div>
      </Dialog>
    </>
  );
};

export default ScenarioRemoveOutcomeAction;

