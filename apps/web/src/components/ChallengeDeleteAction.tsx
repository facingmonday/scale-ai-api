import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import challengeService from "@/services/challenge";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";

type Props = {
  challengeId: string;
  scenarioName?: string;
  disabled?: boolean;
};

const ScenarioDeleteAction: React.FC<Props> = ({
  challengeId,
  scenarioName,
  disabled = false,
}) => {
  const navigate = useNavigate();
  const globalContext = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDelete = async () => {
    if (!challengeId || isProcessing) return;

    setIsProcessing(true);
    try {
      globalContext?.showToast?.("Deleting challenge...", "loading");
      await challengeService.remove(challengeId);
      globalContext?.showToast?.("Challenge deleted successfully", "success");
      setIsOpen(false);
      navigate("/challenges");
    } catch (e) {
      console.error("Failed to delete challenge:", e);
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
          <h3 className="font-semibold mb-1">Delete Challenge</h3>
          <p className="text-text-muted text-sm">
            Permanently delete this challenge. This will remove it from all
            classrooms and delete all associated data including decisions and
            outcomes.
          </p>
        </div>
        <Button
          label="Delete Challenge"
          icon="pi pi-trash"
          onClick={() => setIsOpen(true)}
          severity="danger"
          outlined
          className="[&_.p-button-icon]:mr-3"
          disabled={disabled}
        />
      </div>

      <Dialog
        header="Delete Challenge"
        visible={isOpen}
        onHide={() => !isProcessing && setIsOpen(false)}
        modal
        closable={!isProcessing}
        dismissableMask={!isProcessing}
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
              disabled={isProcessing}
            />
            <Button
              label="Delete Challenge"
              icon="pi pi-check"
              onClick={handleDelete}
              severity="danger"
              loading={isProcessing}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">
            Are you sure you want to permanently delete{" "}
            <strong>{scenarioName || "this challenge"}</strong>? This will:
          </p>
          <ul className="list-disc list-inside text-text-muted ml-4">
            <li>Remove it from all classrooms</li>
            <li>Delete all decisions for this challenge</li>
            <li>Delete the challenge outcome</li>
            <li>Permanently delete the challenge</li>
          </ul>
          <p className="text-red-400 font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Dialog>
    </>
  );
};

export default ScenarioDeleteAction;

