import React from "react";

export interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  className?: string;
}

interface AlertProps {
  icon?: string;
  title: string;
  message: React.ReactNode;
  actions?: AlertAction[];
  variant?: "info" | "success" | "warning" | "error";
  onClose?: () => void;
  closable?: boolean;
}

const Alert: React.FC<AlertProps> = ({
  icon,
  title,
  message,
  actions = [],
  variant = "info",
  onClose,
  closable = false,
}) => {
  const variantClasses = {
    info: "alert-info",
    success: "alert-success",
    warning: "alert-warning",
    error: "alert-error",
  };

  const getButtonClass = (action: AlertAction) => {
    if (action.className) return action.className;
    if (action.variant === "secondary") return "btn-outline";
    return "btn-teal";
  };

  return (
    <div className={`alert ${variantClasses[variant]}`}>
      <div className="alert-content">
        {icon && (
          <div className="alert-icon">
            <i className={icon} />
          </div>
        )}
        <div className="alert-body">
          <div className="alert-title">{title}</div>
          <div className="alert-message">{message}</div>
          {actions.length > 0 && (
            <div className="alert-actions">
              {actions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  className={getButtonClass(action)}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {closable && onClose && (
          <button
            type="button"
            className="alert-close"
            onClick={onClose}
            aria-label="Close alert"
          >
            <i className="pi pi-times" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;

