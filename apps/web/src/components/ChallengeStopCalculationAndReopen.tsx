import React, { useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import challengeService from "@/services/challenge";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";

type Props = {
  challengeId: string;
  challengeName?: string;
  closeSubmissionsAt?: string;
  processAt?: string;
  calculationActive?: boolean;
  disabled?: boolean;
  onSuccess?: () => void | Promise<void>;
};

const ChallengeStopCalculationAndReopen: React.FC<Props> = ({
  challengeId,
  challengeName,
  closeSubmissionsAt = "",
  processAt = "",
  calculationActive = true,
  disabled = false,
  onSuccess,
}) => {
  const globalContext = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const [newLockAt, setNewLockAt] = useState(closeSubmissionsAt);
  const [newProcessAt, setNewProcessAt] = useState(
    processAt && processAt >= closeSubmissionsAt ? processAt : closeSubmissionsAt,
  );
  const actionTitle = calculationActive
    ? "Stop Calculation and Reopen"
    : "Reset Results and Reopen";

  const validationError = useMemo(() => {
    if (!newLockAt || !newProcessAt) return "Both dates are required.";
    if (openedAt && new Date(newLockAt).getTime() <= openedAt) {
      return "The new submissions lock date must be in the future.";
    }
    if (newProcessAt < newLockAt) {
      return "The outcome calculation date cannot be before the submissions lock date.";
    }
    return null;
  }, [newLockAt, newProcessAt, openedAt]);

  const openDialog = () => {
    setOpenedAt(Date.now());
    const effectiveProcessAt =
      processAt && processAt >= closeSubmissionsAt ? processAt : closeSubmissionsAt;
    setNewLockAt(closeSubmissionsAt);
    setNewProcessAt(effectiveProcessAt);
    setIsOpen(true);
  };

  const handleLockChange = (value: string) => {
    setNewLockAt(value);
    if (!newProcessAt || newProcessAt < value) setNewProcessAt(value);
  };

  const handleStopAndReopen = async () => {
    if (!challengeId || isProcessing || validationError) return;
    setIsProcessing(true);
    try {
      globalContext?.showToast?.("Stopping calculation and reopening...", "loading");
      await challengeService.stopCalculationAndReopen(challengeId, {
        closeSubmissionsAt: new Date(newLockAt).toISOString(),
        processAt: new Date(newProcessAt).toISOString(),
      });
      globalContext?.showToast?.("Calculation stopped and challenge reopened", "success");
      setIsOpen(false);
      await onSuccess?.();
    } catch (error) {
      globalContext?.showToast?.(getErrorMessage(error), "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 p-4">
        <div>
          <h3 className="mb-1 font-semibold">{actionTitle}</h3>
          <p className="text-sm text-text-muted">
            {calculationActive
              ? "Cancel this challenge's calculation, remove premature results, reset decisions to pending, and reopen submissions."
              : "Remove the completed results, reset decisions to pending, and reopen submissions."}
          </p>
        </div>
        <Button
          label={calculationActive ? "Stop and Reopen" : "Reset and Reopen"}
          icon="pi pi-stop-circle"
          severity="warning"
          outlined
          disabled={disabled}
          onClick={openDialog}
        />
      </div>

      <Dialog
        header={actionTitle}
        visible={isOpen}
        onHide={() => !isProcessing && setIsOpen(false)}
        style={{ width: "min(36rem, 95vw)" }}
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label="Cancel"
              text
              disabled={isProcessing}
              onClick={() => setIsOpen(false)}
            />
            <Button
              label={actionTitle}
              severity="warning"
              loading={isProcessing}
              disabled={!!validationError}
              onClick={() => void handleStopAndReopen()}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            This discards all calculated results for <strong>{challengeName || "this challenge"}</strong>.
            Existing student decisions are preserved and reset to pending.
          </p>
          <label className="flex flex-col gap-2">
            <span className="label">New submissions lock date</span>
            <input
              type="datetime-local"
              className="input"
              value={newLockAt}
              onChange={(event) => handleLockChange(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="label">New outcome calculation date</span>
            <input
              type="datetime-local"
              className="input"
              value={newProcessAt}
              min={newLockAt || undefined}
              onChange={(event) => setNewProcessAt(event.target.value)}
            />
          </label>
          {validationError && <p className="text-sm text-red-400">{validationError}</p>}
        </div>
      </Dialog>
    </>
  );
};

export default ChallengeStopCalculationAndReopen;
