import React, { useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";

interface CloseScenarioFormProps {
  visible: boolean;
  onHide: () => void;
  onSubmit: (reason: string) => void;
  scenarioName?: string;
}

const CloseScenarioForm: React.FC<CloseScenarioFormProps> = ({
  visible,
  onHide,
  onSubmit,
  scenarioName,
}) => {
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    onSubmit(reason.trim());
    setReason("");
    onHide();
  };

  return (
    <Dialog
      header={`Close Challenge${scenarioName ? `: ${scenarioName}` : ""}`}
      visible={visible}
      onHide={onHide}
      style={{ width: "50vw" }}
      pt={{
        footer: { className: "modal-footer" },
        headerTitle: { className: "modal-title" },
      }}
      footer={
        <div className="flex gap-2 justify-end">
          <Button label="Cancel" icon="pi pi-times" onClick={onHide} text />
          <Button
            label="Close Challenge"
            icon="pi pi-check"
            onClick={handleSubmit}
            severity="danger"
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-gray-400">
          Are you sure you want to close this challenge? This action cannot be
          undone.
        </p>
      </div>
    </Dialog>
  );
};

export default CloseScenarioForm;
