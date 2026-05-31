import React from "react";
import { Link } from "react-router-dom";

interface ScenarioSummaryRowProps {
  challenge?: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    [key: string]: unknown;
  };
  to?: string;
  onClick?: () => void;
}

const ScenarioSummaryRow: React.FC<ScenarioSummaryRowProps> = ({
  challenge,
  to,
  onClick,
}) => {
  if (!challenge) {
    return null;
  }

  const isInteractive = Boolean(to || onClick);
  const className = [
    "challenge-summary-row",
    isInteractive ? "challenge-summary-row-clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <div className="flex justify-between items-center px-4 py-2">
      <div>
        <h3 className="challenge-summary-row-title">{challenge.name}</h3>
        <p className="challenge-summary-row-subtitle">
          Status: {challenge.status}
        </p>
      </div>
      <div className="challenge-summary-row-date">
        {new Date(challenge.createdAt).toLocaleDateString()}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        className={className}
        to={to}
        onClick={onClick}
        aria-label={`View challenge: ${challenge.name}`}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={`View challenge: ${challenge.name}`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
};

export default ScenarioSummaryRow;
