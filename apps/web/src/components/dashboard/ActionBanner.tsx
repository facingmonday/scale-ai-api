import React from "react";

interface ActionBannerProps {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onClick: () => void;
  badgeClass: "badge-success" | "badge-warning";
}

export const ActionBanner: React.FC<ActionBannerProps> = ({
  title,
  subtitle,
  ctaLabel,
  onClick,
  badgeClass,
}) => {
  return (
    <div className="student-dashboard-action-banner">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`badge ${badgeClass}`}>Action</span>
            <div className="student-dashboard-action-banner-title">{title}</div>
          </div>
          <div className="student-dashboard-action-banner-subtitle">
            {subtitle}
          </div>
        </div>

        <button type="button" className="btn-teal" onClick={onClick}>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};
