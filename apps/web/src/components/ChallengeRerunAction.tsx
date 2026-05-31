import React, { useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import challengeService from "@/services/challenge";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";

type Props = {
  challengeId: string;
  scenarioName?: string;
  disabled?: boolean;
  onSuccess?: () => void | Promise<void>;
};

const ScenarioRerunAction: React.FC<Props> = ({
  challengeId,
  scenarioName,
  disabled = false,
  onSuccess,
}) => {
  const globalContext = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRerun = async () => {
    if (!challengeId || isProcessing) return;

    setIsProcessing(true);
    try {
      globalContext?.showToast?.("Rerunning challenge...", "loading");
      await challengeService.rerun(challengeId);
      globalContext?.showToast?.("Challenge rerun successfully", "success");
      setIsOpen(false);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (e) {
      console.error("Failed to rerun challenge:", e);
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
          <h3 className="font-semibold mb-1">Rerun Challenge Outcome</h3>
          <p className="text-text-muted text-sm">
            Rerun the challenge processing. This will recalculate the challenge
            outcomes.
          </p>
        </div>
        <Button
          label="Rerun Challenge"
          icon="pi pi-replay"
          onClick={() => setIsOpen(true)}
          severity="danger"
          outlined
          className="[&_.p-button-icon]:mr-3"
          disabled={disabled}
        />
      </div>

      <Dialog
        header="Rerun Challenge"
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
              label="Rerun Challenge"
              icon="pi pi-check"
              onClick={handleRerun}
              severity="danger"
              loading={isProcessing}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">
            Are you sure you want to rerun{" "}
            <strong>{scenarioName || "this challenge"}</strong>? This will
            recalculate the challenge outcomes.
          </p>
        </div>
      </Dialog>
    </>
  );
};

export default ScenarioRerunAction;

