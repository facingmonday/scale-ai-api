import React from "react";
import { Button } from "primereact/button";

interface CloseScenarioButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const CloseScenarioButton: React.FC<CloseScenarioButtonProps> = ({
  onClick,
  disabled = false,
  className = "",
}) => {
  return (
    <Button
      label="Close Challenge"
      icon="pi pi-times"
      onClick={onClick}
      disabled={disabled}
      className={className}
      severity="danger"
    />
  );
};

export default CloseScenarioButton;

