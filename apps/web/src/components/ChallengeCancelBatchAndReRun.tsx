import React, { useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import challengeService from "@/services/challenge";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";
import axios from "axios";

type Props = {
  challengeId: string;
  scenarioName?: string;
  disabled?: boolean;
  onSuccess?: () => void | Promise<void>;
};

function getCancelBatchAndRerunErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 400) {
      return "Set the challenge outcome before rerunning.";
    }
    if (status === 403) {
      return "You don't have permission to perform this action.";
    }
    if (status === 404) {
      return "Challenge not found.";
    }
    if (status === 500) {
      const serverMessage = getErrorMessage(error);
      if (serverMessage && serverMessage !== "An error occurred") {
        return serverMessage;
      }
      return "A server error occurred. Please try again.";
    }
  }
  return getErrorMessage(error);
}

const ScenarioCancelBatchAndReRun: React.FC<Props> = ({
  challengeId,
  scenarioName,
  disabled = false,
  onSuccess,
}) => {
  const globalContext = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCancelBatchAndRerun = async () => {
    if (!challengeId || isProcessing) return;

    setIsProcessing(true);
    try {
      globalContext?.showToast?.("Cancelling batch and rerunning...", "loading");
      const result = await challengeService.cancelBatchAndRerun(challengeId);

      const data = (result as { data?: { jobsCreated?: number } })?.data;
      const jobsCreated = data?.jobsCreated;
      const message =
        typeof jobsCreated === "number"
          ? `Rerun initiated. ${jobsCreated} jobs queued.`
          : "Batch cancelled and challenge rerun initiated.";

      globalContext?.showToast?.(message, "success");
      setIsOpen(false);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (e) {
      console.error("Failed to cancel batch and rerun challenge:", e);
      const errorMessage = getCancelBatchAndRerunErrorMessage(e);
      globalContext?.showToast?.(errorMessage, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border border-red-500/20 rounded-lg">
        <div>
          <h3 className="font-semibold mb-1">Cancel Batch and Rerun</h3>
          <p className="text-text-muted text-sm">
            Cancel any in-progress batch, reset all student results, and rerun
            the simulation. Use when the batch is stuck or to force a restart.
          </p>
        </div>
        <Button
          label="Cancel Batch and Rerun"
          icon="pi pi-replay"
          onClick={() => setIsOpen(true)}
          severity="danger"
          outlined
          className="[&_.p-button-icon]:mr-3"
          disabled={disabled}
        />
      </div>

      <Dialog
        header="Cancel Batch and Rerun"
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
              label="Cancel Batch and Rerun"
              icon="pi pi-check"
              onClick={handleCancelBatchAndRerun}
              severity="danger"
              loading={isProcessing}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">
            This will cancel any in-progress batch, reset all student results for{" "}
            <strong>{scenarioName || "this challenge"}</strong>, and rerun the
            simulation. Students will see new results when processing completes.
          </p>
          <p className="text-text-muted font-medium">Continue?</p>
        </div>
      </Dialog>
    </>
  );
};

export default ScenarioCancelBatchAndReRun;
